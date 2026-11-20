package transit

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// TestExtractDownloadProgress downloads a made-up extract that arrives in
// pieces and isn't a real .osm.pbf, checking the steps the page is shown
// along the way and that the failure stays listed with why.
func TestExtractDownloadProgress(t *testing.T) {
	piece := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Length", "2048")
		for range 2 {
			<-piece
			_, _ = w.Write(make([]byte, 1024))
			w.(http.Flusher).Flush()
		}
	}))
	t.Cleanup(srv.Close)
	dir := t.TempDir()
	t.Setenv("OSM_RAIL_DIR", dir)
	index := strings.ReplaceAll(koreaIndex, "https://example.com", srv.URL)
	if err := os.WriteFile(filepath.Join(dir, geofabrikIndexFile), []byte(index), 0o600); err != nil {
		t.Fatal(err)
	}
	c := &Client{HTTP: srv.Client()}
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	if _, err := c.OSMBusLines(ctx, "bus", seoulStation, gwanghwamun); !errors.Is(err, ErrMapLoading) {
		t.Fatalf("err = %v, want ErrMapLoading while it downloads", err)
	}
	piece <- struct{}{}
	d := waitFor(t, c, func(d Download) bool { return d.Bytes == 1024 })
	if d.Step != StepDownloading || d.Total != 2048 || !strings.Contains(d.URL, "south-korea.osm.pbf") || d.Map != "OpenStreetMap's bus map of South Korea" {
		t.Errorf("halfway = %+v", d)
	}
	piece <- struct{}{}
	d = waitFor(t, c, func(d Download) bool { return d.Step == StepFailed })
	if !strings.Contains(d.Error, "reading the railways from South Korea's extract failed") || !strings.Contains(d.Detail, "pass 1 of 5 over the 2 KB extract") {
		t.Errorf("failed = %+v", d)
	}
}

// waitFor is the first download listed once ok holds for it, failing after a
// second.
func waitFor(t *testing.T, c *Client, ok func(Download) bool) Download {
	t.Helper()
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		if list := c.Downloads(); len(list) == 1 && ok(list[0]) {
			return list[0]
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatalf("downloads = %+v", c.Downloads())
	return Download{}
}
