package routing

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPath(t *testing.T) {
	var asked string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		asked = r.URL.String()
		_, _ = w.Write([]byte(`{"code":"Ok","routes":[{"geometry":{"coordinates":[[135.5,34.66],[135.501,34.661],[135.502,34.663]]}}]}`))
	}))
	defer srv.Close()
	c := &Client{BaseURL: srv.URL, HTTP: srv.Client()}
	got, err := c.Path(t.Context(), "walk", [][2]float64{{135.5, 34.66}, {135.502, 34.663}})
	if err != nil {
		t.Fatalf("Path() error = %v", err)
	}
	if len(got) != 3 {
		t.Errorf("Path() = %v, want 3 points", got)
	}
	want := "/routed-foot/route/v1/driving/135.500000,34.660000;135.502000,34.663000?overview=full&geometries=geojson"
	if asked != want {
		t.Errorf("asked %s, want %s", asked, want)
	}
	if _, err := c.Path(t.Context(), "train", [][2]float64{{0, 0}, {1, 1}}); !errors.Is(err, ErrNoProfile) {
		t.Errorf("train: Path() error = %v, want ErrNoProfile", err)
	}
}

func TestPathNoRoute(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"code":"NoRoute","message":"Impossible route between points"}`))
	}))
	defer srv.Close()
	c := &Client{BaseURL: srv.URL, HTTP: srv.Client()}
	if _, err := c.Path(t.Context(), "car", [][2]float64{{0, 0}, {1, 1}}); err == nil {
		t.Error("Path() found a route the server didn't")
	}
}
