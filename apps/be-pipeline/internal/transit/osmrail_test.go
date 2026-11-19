package transit

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/paulmach/osm"
)

// koreaIndex is a made-up Geofabrik index: Asia, which has no parent and so is
// never downloaded, South Korea inside it, and Japan beside it.
const koreaIndex = `{"type":"FeatureCollection","features":[
	{"type":"Feature","properties":{"id":"asia","name":"Asia","urls":{"pbf":"https://example.com/asia.osm.pbf"}},
	 "geometry":{"type":"Polygon","coordinates":[[[60,0],[150,0],[150,60],[60,60],[60,0]]]}},
	{"type":"Feature","properties":{"id":"south-korea","parent":"asia","name":"South Korea","urls":{"pbf":"https://example.com/south-korea.osm.pbf"}},
	 "geometry":{"type":"MultiPolygon","coordinates":[[[[125,33],[130,33],[130,39],[125,39],[125,33]]]]}},
	{"type":"Feature","properties":{"id":"japan","parent":"asia","name":"Japan","urls":{"pbf":"https://example.com/japan.osm.pbf"}},
	 "geometry":{"type":"Polygon","coordinates":[[[129.5,30],[146,30],[146,46],[129.5,46],[129.5,30]],[[129.5,33],[130,33],[130,34],[129.5,34],[129.5,33]]]}}
]}`

var (
	seoul = [2]float64{126.9707, 37.5547}
	busan = [2]float64{129.0414, 35.1151}
	tokyo = [2]float64{139.767, 35.681}
)

func TestRegionFor(t *testing.T) {
	regions, err := geofabrikIndex([]byte(koreaIndex))
	if err != nil {
		t.Fatal(err)
	}
	if len(regions) != 2 {
		t.Fatalf("regions = %+v, want Asia left out", regions)
	}
	i, err := regionFor(regions, seoul, busan)
	if err != nil || regions[i].id != "south-korea" {
		t.Errorf("Seoul to Busan: %v, %v", i, err)
	}
	if _, err := regionFor(regions, seoul, tokyo); !errors.Is(err, errNoRegion) {
		t.Errorf("Seoul to Tokyo: err = %v, want errNoRegion", err)
	}
	// Japan's outline has a hole there.
	if regions[1].holds([2]float64{129.7, 33.5}) {
		t.Error("a spot in Japan's hole is held")
	}
}

// way is a railway way through nodes.
func way(railway, name, nameEn string, nodes ...osm.NodeID) *osm.Way {
	w := &osm.Way{Tags: osm.Tags{{Key: "railway", Value: railway}, {Key: "operator", Value: "Korail"}}}
	if name != "" {
		w.Tags = append(w.Tags, osm.Tag{Key: "name", Value: name})
	}
	if nameEn != "" {
		w.Tags = append(w.Tags, osm.Tag{Key: "name:en", Value: nameEn})
	}
	for _, n := range nodes {
		w.Nodes = append(w.Nodes, osm.WayNode{ID: n})
	}
	return w
}

// node is a node at p, a station when name is set.
func node(id osm.NodeID, p [2]float64, name string) *osm.Node {
	n := &osm.Node{ID: id, Lon: p[0], Lat: p[1]}
	if name != "" {
		n.Tags = osm.Tags{{Key: "railway", Value: "station"}, {Key: "name", Value: name}}
	}
	return n
}

// koreaRail is a made-up South Korea: 경부고속선 from Seoul to Daejeon and on
// to Busan, half its ways named in English, a yard track, and an unnamed
// curve joining 경부선 at Daejeon.
func koreaRail() *osmRailReader {
	daejeon := [2]float64{127.4341, 36.3325}
	r := newOSMRailReader()
	r.addWay(way("rail", "경부고속선", "Gyeongbu HSR", 1, 2))
	r.addWay(way("rail", "경부고속선", "Gyeongbu HSR", 2, 3))
	r.addWay(way("rail", "경부고속선", "", 3, 4))
	r.addWay(way("rail", "", "", 2, 5))
	r.addWay(way("rail", "경부선", "", 5, 6))
	yard := way("rail", "", "", 1, 7)
	yard.Tags = append(yard.Tags, osm.Tag{Key: "service", Value: "yard"})
	r.addWay(yard)
	r.addWay(way("tram", "Tram", "", 1, 4))
	for _, n := range []*osm.Node{
		node(1, seoul, "서울"), node(2, daejeon, "대전"), node(3, [2]float64{128.5, 35.8}, ""),
		node(4, busan, "부산"), node(5, [2]float64{127.436, 36.332}, ""), node(6, [2]float64{127.5, 36.0}, "Okcheon"),
		node(7, [2]float64{126.97, 37.56}, ""), node(8, [2]float64{0, 0}, "Nowhere"),
	} {
		r.addNode(n)
	}
	return r
}

func TestOSMRailFeatures(t *testing.T) {
	sections, stations := koreaRail().features()
	if len(sections) != 5 {
		t.Fatalf("sections = %d, want the five ways a ride can follow", len(sections))
	}
	lines := map[string]bool{}
	for _, f := range sections {
		lines[f.Properties.Line] = true
	}
	if !lines["Gyeongbu HSR"] || !lines["경부선"] || !lines[""] || len(lines) != 3 {
		t.Errorf("lines = %v", lines)
	}
	got := map[string]string{}
	for _, f := range stations {
		got[f.Properties.Station] += f.Properties.Line + ";"
	}
	if got["서울"] != "Gyeongbu HSR;" || got["대전"] != "Gyeongbu HSR;경부선;" || got["Nowhere"] != "" {
		t.Errorf("stations = %v", got)
	}
}

func TestOSMRailLines(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("OSM_RAIL_DIR", dir)
	if err := os.WriteFile(filepath.Join(dir, geofabrikIndexFile), []byte(koreaIndex), 0o600); err != nil {
		t.Fatal(err)
	}
	sections, stations := koreaRail().features()
	region := filepath.Join(dir, "south-korea")
	if err := os.MkdirAll(region, 0o750); err != nil {
		t.Fatal(err)
	}
	if err := writeFeatures(filepath.Join(region, mlitStationsFile), stations); err != nil {
		t.Fatal(err)
	}
	if err := writeFeatures(filepath.Join(region, mlitSectionsFile), sections); err != nil {
		t.Fatal(err)
	}
	c := &Client{HTTP: http.DefaultClient}
	ctx := context.Background()
	lines, err := c.OSMRailLines(ctx, "train", seoul, busan)
	if err != nil {
		t.Fatal(err)
	}
	if len(lines) != 1 || lines[0].Name != "Gyeongbu HSR" || lines[0].Source != SourceOSMRail || lines[0].From != "Korail" {
		t.Fatalf("lines = %+v", lines)
	}
	if lines[0].ID>>osmLineBits != 1 {
		t.Errorf("ID %d doesn't name South Korea, the index's second region", lines[0].ID)
	}
	track, err := c.OSMRailTrack(ctx, lines[0].ID, seoul, busan)
	if err != nil || len(track) != 6 {
		t.Errorf("track = %v, %v", track, err)
	}
	okcheon := [2]float64{127.5, 36.0}
	lines, err = c.OSMRailLines(ctx, "train", seoul, okcheon)
	if err != nil || len(lines) == 0 || lines[0].Name != "Gyeongbu HSR → 경부선" {
		t.Errorf("Seoul to Okcheon = %+v, %v; the unnamed curve isn't a line of its own", lines, err)
	}
	stops, err := c.OSMRailStops(ctx, lines[0].ID)
	if err != nil || len(stops) != 4 {
		t.Errorf("stops = %+v, %v", stops, err)
	}
	if _, err := c.OSMRailLines(ctx, "train", seoul, tokyo); !errors.As(err, new(*RailMapError)) {
		t.Errorf("Seoul to Tokyo: err = %v", err)
	}
}

func TestOSMRailIndexDownload(t *testing.T) {
	hits := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		hits++
		_, _ = w.Write([]byte(koreaIndex))
	}))
	t.Cleanup(srv.Close)
	t.Setenv("OSM_RAIL_DIR", t.TempDir())
	t.Setenv("GEOFABRIK_INDEX_URL", srv.URL)
	c := &Client{HTTP: srv.Client()}
	for range 2 {
		regions, err := c.osmRegions(context.Background())
		if err != nil || len(regions) != 2 {
			t.Fatalf("regions = %d, %v", len(regions), err)
		}
	}
	if hits != 1 {
		t.Errorf("downloaded %d times, want once", hits)
	}
}

func TestLimitedWriter(t *testing.T) {
	var got []byte
	w := &limitedWriter{w: writerFunc(func(p []byte) { got = append(got, p...) }), left: 4}
	if _, err := w.Write([]byte("abc")); err != nil {
		t.Fatal(err)
	}
	if _, err := w.Write([]byte("de")); !errors.Is(err, errExtractTooBig) {
		t.Errorf("err = %v", err)
	}
	if string(got) != "abc" {
		t.Errorf("wrote %q", got)
	}
}

// writerFunc is a function used as an io.Writer.
type writerFunc func([]byte)

func (f writerFunc) Write(p []byte) (int, error) { f(p); return len(p), nil }
