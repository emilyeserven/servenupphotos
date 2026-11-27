package httpapi

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/transit"
)

// fakeFinder answers the rail and bus maps' lines and tracks from its fields, keeping what it was asked.
type fakeFinder struct {
	mode     string
	from [2]float64
	err      error
	// downloads are the maps Downloads lists.
	downloads []transit.Download
}

func (f *fakeFinder) MLITLines(_ context.Context, mode string, from, _ [2]float64) ([]transit.Line, error) {
	f.mode, f.from = mode, from
	if mode == "walk" {
		return nil, transit.ErrNoKind
	}
	return []transit.Line{{ID: 255, Name: "山陰線", Kind: "train", Source: transit.SourceMLIT}}, f.err
}

func (f *fakeFinder) MLITTrack(_ context.Context, _ int64, from, to [2]float64) ([][2]float64, error) {
	return [][2]float64{from, {2, 2}, to}, f.err
}

func (f *fakeFinder) MLITStops(_ context.Context, _ int64) ([]transit.Stop, error) {
	return []transit.Stop{{Name: "東萩", Latitude: 34.42, Longitude: 131.41}}, f.err
}

func (f *fakeFinder) OSMRailLines(_ context.Context, mode string, from, _ [2]float64) ([]transit.Line, error) {
	f.mode, f.from = mode, from
	return []transit.Line{{ID: 1 << 48, Name: "Gyeongbu HSR", Kind: "train", Source: transit.SourceOSMRail}}, f.err
}

func (f *fakeFinder) OSMRailTrack(_ context.Context, _ int64, from, to [2]float64) ([][2]float64, error) {
	return [][2]float64{from, {4, 4}, to}, f.err
}

func (f *fakeFinder) OSMRailStops(_ context.Context, _ int64) ([]transit.Stop, error) {
	return []transit.Stop{{Name: "Seoul", Latitude: 37.55, Longitude: 126.97}}, f.err
}

func (f *fakeFinder) OSMBusLines(_ context.Context, mode string, from, _ [2]float64) ([]transit.Line, error) {
	if mode != "bus" {
		return nil, transit.ErrNoKind
	}
	f.mode, f.from = mode, from
	return []transit.Line{{ID: 1<<40 | 77, Name: "Bus 7: Seoul Station → City Hall", Kind: "bus", Source: transit.SourceOSMBus}}, f.err
}

func (f *fakeFinder) OSMBusTrack(_ context.Context, _ int64, from, to [2]float64) ([][2]float64, error) {
	return [][2]float64{from, {6, 6}, to}, f.err
}

func (f *fakeFinder) OSMBusStops(_ context.Context, _ int64) ([]transit.Stop, error) {
	return []transit.Stop{{Name: "City Hall", Latitude: 37.56, Longitude: 126.97}}, f.err
}

func (f *fakeFinder) Searched(source string, _, _ [2]float64) string {
	return "searched " + source
}

func (f *fakeFinder) Downloads() []transit.Download {
	return f.downloads
}

func (f *fakeFinder) RailRides(_ context.Context, source string, _ int64, from, to [2]float64) ([]transit.RouteRide, error) {
	if source != transit.SourceMLIT {
		return nil, f.err
	}
	return []transit.RouteRide{
		{Line: transit.Line{ID: 31, Name: "北松江線"}, Path: [][2]float64{from, {2, 2}}, Change: &transit.Stop{Name: "川跡"}},
		{Line: transit.Line{ID: 30, Name: "大社線"}, Path: [][2]float64{{2, 2}, to}},
	}, f.err
}

func TestTrackRides(t *testing.T) {
	rec := httptest.NewRecorder()
	transitMux(&fakeFinder{}).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/transit/lines/7969/track?from=0,0&to=3,3&source=mlit", nil))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"name":"川跡"`) || !strings.Contains(rec.Body.String(), "大社線") {
		t.Errorf("mlit: %d %s", rec.Code, rec.Body)
	}
	rec = httptest.NewRecorder()
	transitMux(&fakeFinder{}).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/transit/lines/7/track?from=0,0&to=3,3&source=osmbus", nil))
	if strings.Contains(rec.Body.String(), "rides") {
		t.Errorf("bus map: %s", rec.Body)
	}
}

func TestOSMRailSource(t *testing.T) {
	f := &fakeFinder{}
	for url, body := range map[string]string{
		"/transit/lines?mode=train&from=126.97,37.55&to=129.04,35.12&source=osmrail": "Gyeongbu HSR",
		"/transit/lines/281474976710656/stops?source=osmrail":                        "Seoul",
		"/transit/lines/281474976710656/track?from=0,0&to=5,5&source=osmrail":        "[4,4]",
	} {
		rec := httptest.NewRecorder()
		transitMux(f).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, url, nil))
		if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), body) {
			t.Errorf("%s: %d %s", url, rec.Code, rec.Body)
		}
	}
}

func TestOSMBusSource(t *testing.T) {
	f := &fakeFinder{}
	for url, body := range map[string]string{
		"/transit/lines?mode=bus&from=126.97,37.55&to=126.98,37.57&source=osmbus": "Bus 7",
		"/transit/lines/1099511627853/stops?source=osmbus":                        "City Hall",
		"/transit/lines/1099511627853/track?from=0,0&to=5,5&source=osmbus":        "[6,6]",
	} {
		rec := httptest.NewRecorder()
		transitMux(f).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, url, nil))
		if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), body) {
			t.Errorf("%s: %d %s", url, rec.Code, rec.Body)
		}
	}
	rec := httptest.NewRecorder()
	transitMux(f).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/transit/lines?mode=bus&from=0,0&to=1,1&source=osmbus", nil))
	if got := rec.Header().Get("X-Transit-Searched"); got != "searched%20osmbus" {
		t.Errorf("searched header = %q", got)
	}
	rec = httptest.NewRecorder()
	transitMux(f).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/transit/lines?mode=train&from=0,0&to=1,1&source=osmbus", nil))
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "only has buses") {
		t.Errorf("train on the bus map: %d %s", rec.Code, rec.Body)
	}
}

func TestTransitDownloads(t *testing.T) {
	f := &fakeFinder{downloads: []transit.Download{{Map: "OpenStreetMap's bus map of South Korea", Step: transit.StepDownloading, Bytes: 10, Total: 100}}}
	rec := httptest.NewRecorder()
	transitMux(f).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/transit/downloads", nil))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"bytes":10,"total":100`) {
		t.Errorf("downloads: %d %s", rec.Code, rec.Body)
	}
}

func TestMapStillLoading(t *testing.T) {
	f := &fakeFinder{err: &transit.RailMapError{Map: "Japan's rail map", Err: transit.ErrMapLoading}}
	rec := httptest.NewRecorder()
	transitMux(f).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/transit/lines?mode=train&from=0,0&to=1,1&source=mlit", nil))
	if rec.Code != http.StatusServiceUnavailable || !strings.Contains(rec.Body.String(), `"loading":true`) {
		t.Errorf("still loading: %d %s", rec.Code, rec.Body)
	}
}

func TestMLITSource(t *testing.T) {
	f := &fakeFinder{}
	cases := []struct {
		url  string
		body string
	}{
		{"/transit/lines?mode=train&from=131.41,34.42&to=133.06,35.46&source=mlit", "山陰線"},
		{"/transit/lines/255/stops?source=mlit", "東萩"},
		{"/transit/lines/255/track?from=0,0&to=3,3&source=mlit", "[2,2]"},
	}
	for _, c := range cases {
		rec := httptest.NewRecorder()
		transitMux(f).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, c.url, nil))
		if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), c.body) {
			t.Errorf("%s: %d %s", c.url, rec.Code, rec.Body)
		}
	}
	f.err = &transit.RailMapError{Map: "Japan's rail map", Err: errors.New("it's still downloading")}
	rec := httptest.NewRecorder()
	transitMux(f).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/transit/lines?mode=train&from=0,1&to=1,1&source=mlit", nil))
	if rec.Code != http.StatusServiceUnavailable || !strings.Contains(rec.Body.String(), "still downloading") {
		t.Errorf("not ready: %d %s", rec.Code, rec.Body)
	}
}

func transitMux(f *fakeFinder) *http.ServeMux {
	mux := http.NewServeMux()
	registerTripLineRoutes(mux, routeDeps{transit: f})
	return mux
}

func TestTransitLines(t *testing.T) {
	f := &fakeFinder{}
	cases := []struct {
		url    string
		status int
		body   string
	}{
		{"/transit/lines?mode=subway&from=135.5,34.66&to=135.49,34.7&source=mlit", http.StatusOK, "山陰線"},
		{"/transit/lines?mode=walk&from=135.5,34.66&to=135.49,34.7&source=mlit", http.StatusBadRequest, "only have trains and subways"},
		{"/transit/lines?mode=subway&from=135.5&to=135.49,34.7&source=mlit", http.StatusBadRequest, "longitude,latitude"},
		{"/transit/lines?mode=subway&from=200,34&to=135.49,34.7&source=mlit", http.StatusBadRequest, "longitude,latitude"},
		{"/transit/lines?mode=subway&from=135.5,34.66&to=135.49,34.7", http.StatusBadRequest, "only looks lines up on the rail and bus maps"},
		{"/transit/lines?mode=subway&from=135.5,34.66&to=135.49,34.7&source=transitland", http.StatusBadRequest, "the BFF answers"},
	}
	for _, c := range cases {
		rec := httptest.NewRecorder()
		transitMux(f).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, c.url, nil))
		if rec.Code != c.status || !strings.Contains(rec.Body.String(), c.body) {
			t.Errorf("%s: %d %s", c.url, rec.Code, rec.Body)
		}
	}
	if f.from != [2]float64{135.5, 34.66} {
		t.Errorf("from = %v", f.from)
	}
}

func TestTransitTrack(t *testing.T) {
	rec := httptest.NewRecorder()
	transitMux(&fakeFinder{}).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/transit/lines/7/track?from=1,2&to=3,4&source=osmbus", nil))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"path":[[1,2],[6,6],[3,4]]`) {
		t.Errorf("track: %d %s", rec.Code, rec.Body)
	}
	rec = httptest.NewRecorder()
	transitMux(&fakeFinder{err: transit.ErrNoTrack}).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/transit/lines/7/track?from=1,2&to=3,4&source=osmbus", nil))
	if rec.Code != http.StatusUnprocessableEntity {
		t.Errorf("no track: %d", rec.Code)
	}
	rec = httptest.NewRecorder()
	transitMux(&fakeFinder{}).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/transit/lines/x/track?from=1,2&to=3,4&source=osmbus", nil))
	if rec.Code != http.StatusBadRequest {
		t.Errorf("bad id: %d", rec.Code)
	}
}

func TestTransitStops(t *testing.T) {
	rec := httptest.NewRecorder()
	transitMux(&fakeFinder{}).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/transit/lines/7/stops?source=mlit", nil))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"name":"東萩"`) {
		t.Errorf("stops: %d %s", rec.Code, rec.Body)
	}
}

func TestNoTrackMessage(t *testing.T) {
	far := fmt.Errorf("%w: the first spot is 2.4 km from the route's mapped roads", transit.ErrNoTrack)
	if got := noTrackMessage(far); !strings.Contains(got, "doesn't join those two spots: the first spot is 2.4 km") {
		t.Errorf("far = %q", got)
	}
	if got := noTrackMessage(transit.ErrNoTrack); got != "That line's mapped track doesn't join those two spots. Try another line or direction." {
		t.Errorf("plain = %q", got)
	}
}
