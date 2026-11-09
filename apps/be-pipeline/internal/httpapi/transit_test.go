package httpapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/transit"
)

// fakeFinder answers lines and tracks from its fields, keeping what it was asked.
type fakeFinder struct {
	mode     string
	from, to [2]float64
	err      error
}

func (f *fakeFinder) Lines(_ context.Context, mode string, from, to [2]float64) ([]transit.Line, error) {
	f.mode, f.from, f.to = mode, from, to
	if mode == "walk" {
		return nil, transit.ErrNoKind
	}
	return []transit.Line{{ID: 1, Name: "Midosuji Line", Kind: "subway"}}, f.err
}

func (f *fakeFinder) Track(_ context.Context, _ int64, from, to [2]float64) ([][2]float64, error) {
	return [][2]float64{from, to}, f.err
}

func (f *fakeFinder) Stops(_ context.Context, _ int64) ([]transit.Stop, error) {
	return []transit.Stop{{Name: "Namba", Latitude: 34.66, Longitude: 135.5}}, f.err
}

func (f *fakeFinder) Stations(_ context.Context, mode, name string, near [2]float64) ([]transit.Station, error) {
	f.mode, f.from = mode, near
	if name == "" {
		return nil, transit.ErrNoName
	}
	return []transit.Station{{Name: "博多", NameEn: "Hakata", Latitude: 33.59, Longitude: 130.42}}, f.err
}

func (f *fakeFinder) PhotonStations(_ context.Context, mode, _ string, near [2]float64) ([]transit.Station, error) {
	f.mode, f.from = mode, near
	return []transit.Station{{Name: "Photon Port", Latitude: 33.96, Longitude: 130.93}}, f.err
}

func (f *fakeFinder) TransitlandLines(_ context.Context, mode string, from, _ [2]float64) ([]transit.Line, error) {
	f.mode, f.from = mode, from
	return []transit.Line{{ID: 9, Name: "JR Sanyo Line", Kind: "train", Source: transit.SourceTransitland}}, f.err
}

func (f *fakeFinder) TransitlandTrack(_ context.Context, _ int64, from, to [2]float64) ([][2]float64, error) {
	return [][2]float64{from, {1, 1}, to}, f.err
}

func (f *fakeFinder) TransitlandStops(_ context.Context, _ int64) ([]transit.Stop, error) {
	return []transit.Stop{{Name: "Shimonoseki", Latitude: 33.95, Longitude: 130.92}}, f.err
}

func TestTransitlandSource(t *testing.T) {
	f := &fakeFinder{}
	cases := []struct {
		url  string
		body string
	}{
		{"/transit/lines?mode=train&from=130.92,33.95&to=130.88,33.88&source=transitland", "JR Sanyo Line"},
		{"/transit/lines/9/stops?source=transitland", "Shimonoseki"},
		{"/transit/lines/9/track?from=0,0&to=2,2&source=transitland", "[1,1]"},
	}
	for _, c := range cases {
		rec := httptest.NewRecorder()
		transitMux(f).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, c.url, nil))
		if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), c.body) {
			t.Errorf("%s: %d %s", c.url, rec.Code, rec.Body)
		}
	}
	f.err = transit.ErrNoTransitlandKey
	rec := httptest.NewRecorder()
	transitMux(f).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/transit/lines?mode=train&from=0,1&to=1,1&source=transitland", nil))
	if rec.Code != http.StatusServiceUnavailable || !strings.Contains(rec.Body.String(), "TRANSITLAND_API_KEY") {
		t.Errorf("no key: %d %s", rec.Code, rec.Body)
	}
}

func TestTransitStations(t *testing.T) {
	f := &fakeFinder{}
	cases := []struct {
		url    string
		status int
		body   string
	}{
		{"/transit/stations?mode=train&q=Hakata&near=130.42,33.59", http.StatusOK, "Hakata"},
		{"/transit/stations?mode=ferry&q=Port&near=130.42,33.59&source=photon", http.StatusOK, "Photon Port"},
		{"/transit/stations?mode=train&q=&near=130.42,33.59", http.StatusBadRequest, "station's name"},
		{"/transit/stations?mode=train&q=Hakata", http.StatusBadRequest, "near"},
	}
	for _, c := range cases {
		rec := httptest.NewRecorder()
		transitMux(f).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, c.url, nil))
		if rec.Code != c.status || !strings.Contains(rec.Body.String(), c.body) {
			t.Errorf("%s: %d %s", c.url, rec.Code, rec.Body)
		}
	}
	if f.mode != "train" || f.from != [2]float64{130.42, 33.59} {
		t.Errorf("asked %s near %v", f.mode, f.from)
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
		{"/transit/lines?mode=subway&from=135.5,34.66&to=135.49,34.7", http.StatusOK, "Midosuji Line"},
		{"/transit/lines?mode=walk&from=135.5,34.66&to=135.49,34.7", http.StatusBadRequest, "train, subway, bus"},
		{"/transit/lines?mode=subway&from=135.5&to=135.49,34.7", http.StatusBadRequest, "longitude,latitude"},
		{"/transit/lines?mode=subway&from=200,34&to=135.49,34.7", http.StatusBadRequest, "longitude,latitude"},
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
	transitMux(&fakeFinder{}).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/transit/lines/7/track?from=1,2&to=3,4", nil))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"path":[[1,2],[3,4]]`) {
		t.Errorf("track: %d %s", rec.Code, rec.Body)
	}
	rec = httptest.NewRecorder()
	transitMux(&fakeFinder{err: transit.ErrNoTrack}).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/transit/lines/7/track?from=1,2&to=3,4", nil))
	if rec.Code != http.StatusUnprocessableEntity {
		t.Errorf("no track: %d", rec.Code)
	}
	rec = httptest.NewRecorder()
	transitMux(&fakeFinder{}).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/transit/lines/x/track?from=1,2&to=3,4", nil))
	if rec.Code != http.StatusBadRequest {
		t.Errorf("bad id: %d", rec.Code)
	}
}

func TestTransitStops(t *testing.T) {
	rec := httptest.NewRecorder()
	transitMux(&fakeFinder{}).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/transit/lines/7/stops", nil))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"name":"Namba"`) {
		t.Errorf("stops: %d %s", rec.Code, rec.Body)
	}
}

func TestTransitBusy(t *testing.T) {
	busy := &transit.BusyError{Tries: 6, Servers: 3, Server: "overpass-api.de", Last: &transit.StatusError{Code: 502, Status: "502 Bad Gateway"}}
	rec := httptest.NewRecorder()
	transitMux(&fakeFinder{err: busy}).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/transit/lines?mode=subway&from=1,2&to=3,4", nil))
	if rec.Code != http.StatusServiceUnavailable || !strings.Contains(rec.Body.String(), "busy right now, so we couldn't look up lines (tried 6 times on 3 servers; the last, overpass-api.de, answered 502 Bad Gateway). Try again in a minute.") {
		t.Errorf("busy: %d %s", rec.Code, rec.Body)
	}
}

func TestTransitSlow(t *testing.T) {
	slow := &transit.BusyError{Tries: 3, Servers: 3, Server: "maps.mail.ru", Last: transit.ErrSlow}
	rec := httptest.NewRecorder()
	transitMux(&fakeFinder{err: slow}).ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/transit/lines?mode=subway&from=1,2&to=3,4", nil))
	if rec.Code != http.StatusServiceUnavailable || !strings.Contains(rec.Body.String(), "the last, maps.mail.ru, took too long to answer). Try again in a minute.") {
		t.Errorf("slow: %d %s", rec.Code, rec.Body)
	}
}
