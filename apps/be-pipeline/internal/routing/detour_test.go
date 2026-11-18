package routing

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// detourServer answers foot requests with foot and car requests with car,
// and counts the car requests that allow U-turns at via spots, as a walk
// does.
func detourServer(t *testing.T, foot, car string, cars *int) *Client {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body := foot
		if strings.HasPrefix(r.URL.Path, "/routed-car/") {
			if strings.Contains(r.URL.RawQuery, "continue_straight=false") {
				*cars++
			}
			body = car
		}
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)
	return &Client{BaseURL: srv.URL, HTTP: srv.Client()}
}

// Two spots about 220 m apart along a road, and a foot path that goes down a
// side street and back on the way.
var (
	alongRoad = [][2]float64{{135.5, 34.66}, {135.5024, 34.66}}
	straight  = `{"code":"Ok","routes":[{"geometry":{"coordinates":[[135.5,34.66],[135.5024,34.66]]}}]}`
	sideTrip  = `{"code":"Ok","routes":[{"geometry":{"coordinates":[[135.5,34.66],[135.5,34.657],[135.5012,34.657],[135.5012,34.66],[135.5012,34.657],[135.5024,34.657],[135.5024,34.66]]}}]}`
)

func TestWalkTakesTheRoadAroundADetour(t *testing.T) {
	cars := 0
	c := detourServer(t, sideTrip, straight, &cars)
	got, err := c.Path(t.Context(), "walk", alongRoad)
	if err != nil {
		t.Fatalf("Path() error = %v", err)
	}
	if cars != 1 || len(got) != 2 {
		t.Errorf("Path() = %v after %d road requests, want the road's 2 points after 1", got, cars)
	}
}

func TestWalkKeepsAFootPathWithoutADetour(t *testing.T) {
	cars := 0
	c := detourServer(t, straight, straight, &cars)
	if _, err := c.Path(t.Context(), "walk", alongRoad); err != nil {
		t.Fatalf("Path() error = %v", err)
	}
	if cars != 0 {
		t.Errorf("asked for the road path %d times, want none", cars)
	}
}

func TestWalkKeepsItsDetourWhenTheRoadIsNoShorter(t *testing.T) {
	cars := 0
	c := detourServer(t, sideTrip, sideTrip, &cars)
	got, err := c.Path(t.Context(), "walk", alongRoad)
	if err != nil {
		t.Fatalf("Path() error = %v", err)
	}
	if len(got) != 7 {
		t.Errorf("Path() = %v, want the foot path", got)
	}
}

func TestCarIsNeverAskedAsAWalk(t *testing.T) {
	cars := 0
	c := detourServer(t, sideTrip, sideTrip, &cars)
	if _, err := c.Path(t.Context(), "car", alongRoad); err != nil {
		t.Fatalf("Path() error = %v", err)
	}
	if cars != 0 {
		t.Errorf("asked the road server for a walk %d times, want none", cars)
	}
}
