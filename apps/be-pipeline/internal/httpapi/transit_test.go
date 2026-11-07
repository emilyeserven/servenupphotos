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
