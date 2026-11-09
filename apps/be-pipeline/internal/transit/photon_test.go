package transit

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

// fakePhoton answers every search with body and status, and keeps the last
// query.
func fakePhoton(t *testing.T, status int, body string, got *url.Values) *Client {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		*got = r.URL.Query()
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)
	t.Setenv("PHOTON_URL", srv.URL)
	return &Client{HTTP: srv.Client()}
}

func TestPhotonStations(t *testing.T) {
	var got url.Values
	c := fakePhoton(t, http.StatusOK, `{"features":[
		{"geometry":{"coordinates":[130.93,33.96]},"properties":{"name":"Shimonoseki Port International Terminal"}},
		{"geometry":{"coordinates":[130.94,33.97]},"properties":{"name":"Shimonoseki Port International Terminal"}},
		{"geometry":{"coordinates":[130.92,33.95]},"properties":{"name":""}}
	]}`, &got)
	stations, err := c.PhotonStations(context.Background(), "ferry", " Shimonoseki Kokusai ", [2]float64{130.92, 33.95})
	if err != nil {
		t.Fatal(err)
	}
	if len(stations) != 1 || stations[0].Latitude != 33.96 || stations[0].Km == 0 {
		t.Fatalf("stations = %+v", stations)
	}
	if got.Get("q") != "Shimonoseki Kokusai" || got.Get("osm_tag") != "amenity:ferry_terminal" || got.Get("lang") != "en" || got.Get("bbox") == "" {
		t.Errorf("query = %v", got)
	}
	if _, err := c.PhotonStations(context.Background(), "train", "Hakata", [2]float64{}); err != nil || len(got["osm_tag"]) != 2 {
		t.Errorf("train tags = %v (err %v)", got["osm_tag"], err)
	}
	if _, err := c.PhotonStations(context.Background(), "flight", "Hakata", [2]float64{}); !errors.Is(err, ErrNoKind) {
		t.Errorf("flight: err = %v", err)
	}
}

// fakePhotonByName answers a search for "Shimonoseki" with one station and
// any other with none, keeping every name asked.
func fakePhotonByName(t *testing.T, asked *[]string) *Client {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query().Get("q")
		*asked = append(*asked, q)
		if q == "Shimonoseki" {
			_, _ = w.Write([]byte(`{"features":[{"geometry":{"coordinates":[130.92,33.95]},"properties":{"name":"Shimonoseki"}}]}`))
			return
		}
		_, _ = w.Write([]byte(`{"features":[]}`))
	}))
	t.Cleanup(srv.Close)
	t.Setenv("PHOTON_URL", srv.URL)
	return &Client{HTTP: srv.Client()}
}

func TestPhotonDropsKindWords(t *testing.T) {
	var asked []string
	c := fakePhotonByName(t, &asked)
	stations, err := c.PhotonStations(context.Background(), "train", "shimonoseki Station", [2]float64{130.92, 33.95})
	if err != nil || len(stations) != 0 {
		t.Fatalf("stations = %+v, err %v", stations, err)
	}
	if len(asked) != 2 || asked[1] != "shimonoseki" {
		t.Errorf("asked = %q, want the name as typed, then without Station", asked)
	}
	asked = nil
	if stations, _ := c.PhotonStations(context.Background(), "train", "Shimonoseki Station", [2]float64{}); len(stations) != 1 || len(asked) != 2 {
		t.Errorf("stations = %+v, asked %q", stations, asked)
	}
	asked = nil
	if _, _ = c.PhotonStations(context.Background(), "train", "Station", [2]float64{}); len(asked) != 1 {
		t.Errorf("asked = %q, want one search when the name is only a kind word", asked)
	}
}

func TestPhotonDown(t *testing.T) {
	var got url.Values
	c := fakePhoton(t, http.StatusServiceUnavailable, `busy`, &got)
	_, err := c.PhotonStations(context.Background(), "ferry", "Busan", [2]float64{})
	var perr *PhotonError
	if !errors.As(err, &perr) {
		t.Errorf("err = %v, want a PhotonError", err)
	}
}
