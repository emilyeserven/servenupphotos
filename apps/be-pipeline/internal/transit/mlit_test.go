package transit

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// A made-up corner of the rail map, each spot [longitude, latitude]: 山陽線
// runs north from 下関 to 幡生, where 山陰線 starts and runs on north-east
// through 長門市 to 東萩. 美祢線 leaves 長門市 south-east.
var (
	railShimonoseki = [2]float64{130.92, 33.95}
	railHatabu      = [2]float64{130.93, 33.98}
	railNagato      = [2]float64{131.18, 34.37}
	railHagi        = [2]float64{131.41, 34.42}
	railMine        = [2]float64{131.3, 34.2}
)

// railFeature is one GeoJSON feature as MLIT writes them, of a JR West line.
func railFeature(line, station string, coords ...[2]float64) map[string]any {
	props := map[string]any{"N02_001": "11", "N02_002": "1", "N02_003": line, "N02_004": "西日本旅客鉄道"}
	if station != "" {
		props["N02_005"] = station
	}
	return map[string]any{"type": "Feature", "properties": props, "geometry": map[string]any{"type": "LineString", "coordinates": coords}}
}

// railFiles are the made-up rail map's two GeoJSON files, by name.
func railFiles(t *testing.T) map[string][]byte {
	t.Helper()
	sections := []any{
		railFeature("山陽線", "", railShimonoseki, railHatabu),
		railFeature("山陰線", "", railHatabu, [2]float64{131.0, 34.2}, railNagato),
		railFeature("山陰線", "", railNagato, railHagi),
		railFeature("美祢線", "", railNagato, railMine),
	}
	stations := []any{
		railFeature("山陽線", "下関", railShimonoseki, railShimonoseki),
		railFeature("山陽線", "幡生", railHatabu, railHatabu),
		railFeature("山陰線", "幡生", railHatabu, railHatabu),
		railFeature("山陰線", "長門市", railNagato, railNagato),
		railFeature("山陰線", "東萩", railHagi, railHagi),
		railFeature("美祢線", "長門市", railNagato, railNagato),
	}
	files := map[string][]byte{}
	for name, features := range map[string][]any{mlitSectionsFile: sections, mlitStationsFile: stations} {
		b, err := json.Marshal(map[string]any{"type": "FeatureCollection", "features": features})
		if err != nil {
			t.Fatal(err)
		}
		files[name] = b
	}
	return files
}

// railClient is a client whose rail map is the made-up one, already on disk.
func railClient(t *testing.T) *Client {
	t.Helper()
	dir := t.TempDir()
	for name, b := range railFiles(t) {
		if err := os.WriteFile(filepath.Join(dir, name), b, 0o600); err != nil {
			t.Fatal(err)
		}
	}
	t.Setenv("MLIT_RAIL_DIR", dir)
	return &Client{HTTP: http.DefaultClient}
}

func TestMLITLinesChangesLines(t *testing.T) {
	c := railClient(t)
	ctx := context.Background()
	lines, err := c.MLITLines(ctx, "train", railShimonoseki, railHagi)
	if err != nil {
		t.Fatal(err)
	}
	if len(lines) != 1 || lines[0].Name != "山陽線 → 山陰線" || lines[0].Source != SourceMLIT || lines[0].From != "西日本旅客鉄道" || lines[0].Kind != "train" {
		t.Fatalf("lines = %+v", lines)
	}
	track, err := c.MLITTrack(ctx, lines[0].ID, railShimonoseki, railHagi)
	if err != nil {
		t.Fatal(err)
	}
	want := [][2]float64{railShimonoseki, railShimonoseki, railHatabu, {131.0, 34.2}, railNagato, railHagi, railHagi}
	if len(track) != len(want) {
		t.Fatalf("track = %v", track)
	}
	for i := range want {
		if track[i] != want[i] {
			t.Errorf("track[%d] = %v, want %v", i, track[i], want[i])
		}
	}
	stops, err := c.MLITStops(ctx, lines[0].ID)
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, s := range stops {
		names = append(names, s.Name)
	}
	if got := strings.Join(names, ","); got != "東萩,長門市,幡生,下関" && got != "下関,幡生,長門市,東萩" {
		t.Errorf("stops = %s", got)
	}
}

func TestMLITLinesOneLine(t *testing.T) {
	c := railClient(t)
	lines, err := c.MLITLines(context.Background(), "train", railNagato, railHagi)
	if err != nil {
		t.Fatal(err)
	}
	// The route rides 山陰線 alone, so it's listed once; 美祢線 also passes
	// 長門市 but not 東萩.
	if len(lines) != 1 || lines[0].Name != "山陰線" {
		t.Fatalf("lines = %+v", lines)
	}
	if _, err := c.MLITLines(context.Background(), "bus", railNagato, railHagi); !errors.Is(err, ErrNoKind) {
		t.Errorf("bus: err = %v", err)
	}
}

func TestMLITTrackBadID(t *testing.T) {
	c := railClient(t)
	if _, err := c.MLITTrack(context.Background(), 4095, railNagato, railHagi); !errors.Is(err, ErrNoTrack) {
		t.Errorf("err = %v, want ErrNoTrack", err)
	}
}

func TestRouteID(t *testing.T) {
	n := &railNet{lines: make([]railLine, 600), lineBits: mlitLineBits}
	got, err := n.routeLines(routeID([]int{0, 599, 7}))
	if err != nil || len(got) != 3 || !got[0] || !got[599] || !got[7] {
		t.Errorf("lines = %v, %v", got, err)
	}
}

func TestMLITDownloads(t *testing.T) {
	var zipped bytes.Buffer
	zw := zip.NewWriter(&zipped)
	for name, b := range railFiles(t) {
		for _, folder := range []string{"Shift-JIS/", "UTF-8/"} {
			w, err := zw.Create(folder + name)
			if err != nil {
				t.Fatal(err)
			}
			body := b
			if folder != "UTF-8/" {
				body = []byte("not this one")
			}
			if _, err := w.Write(body); err != nil {
				t.Fatal(err)
			}
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	hits := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		hits++
		_, _ = w.Write(zipped.Bytes())
	}))
	t.Cleanup(srv.Close)
	t.Setenv("MLIT_RAIL_DIR", t.TempDir())
	t.Setenv("MLIT_RAIL_URL", srv.URL+"/N02-24_GML.zip")
	c := &Client{HTTP: srv.Client()}
	for range 2 {
		lines, err := c.MLITLines(context.Background(), "train", railNagato, railHagi)
		if err != nil || len(lines) != 1 {
			t.Fatalf("lines = %+v, err = %v", lines, err)
		}
	}
	if hits != 1 {
		t.Errorf("downloaded %d times, want once", hits)
	}
}

func TestMLITDownloadFails(t *testing.T) {
	srv := httptest.NewServer(http.NotFoundHandler())
	t.Cleanup(srv.Close)
	t.Setenv("MLIT_RAIL_DIR", t.TempDir())
	t.Setenv("MLIT_RAIL_URL", srv.URL)
	c := &Client{HTTP: srv.Client()}
	_, err := c.MLITLines(context.Background(), "train", railNagato, railHagi)
	var mlitErr *RailMapError
	if !errors.As(err, &mlitErr) || !strings.Contains(err.Error(), "404") {
		t.Errorf("err = %v", err)
	}
}

func TestMLITDirBesideSettings(t *testing.T) {
	t.Setenv("MLIT_RAIL_DIR", "")
	t.Setenv("SETTINGS_FILE", "/data/settings.json")
	if got := mlitDir(); got != filepath.Join("/data", "mlit-n02-24") {
		t.Errorf("dir = %s", got)
	}
	t.Setenv("SETTINGS_FILE", "")
	if got := mlitDir(); got != filepath.Join("data", "mlit-n02-24") {
		t.Errorf("dir = %s", got)
	}
}
