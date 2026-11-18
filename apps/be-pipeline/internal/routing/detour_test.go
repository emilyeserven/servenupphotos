package routing

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// detourServer answers foot requests with foot and car requests with car,
// each a route's legs, and counts the car requests that allow U-turns at via
// spots, as a walk does.
func detourServer(t *testing.T, foot, car [][][2]float64, cars *int) *Client {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		legs := foot
		if strings.HasPrefix(r.URL.Path, "/routed-car/") {
			if strings.Contains(r.URL.RawQuery, "continue_straight=false") {
				*cars++
			}
			legs = car
		}
		_ = json.NewEncoder(w).Encode(osrmAnswer(legs))
	}))
	t.Cleanup(srv.Close)
	return &Client{BaseURL: srv.URL, HTTP: srv.Client()}
}

// osrmAnswer is OSRM's answer for a route with legs, each one step.
func osrmAnswer(legs [][][2]float64) map[string]any {
	var path [][2]float64
	outLegs := []any{}
	for _, leg := range legs {
		path = joined(path, leg)
		outLegs = append(outLegs, map[string]any{"steps": []any{map[string]any{"geometry": map[string]any{"coordinates": leg}}}})
	}
	return map[string]any{"code": "Ok", "routes": []any{map[string]any{"geometry": map[string]any{"coordinates": path}, "legs": outLegs}}}
}

// Three spots: a, then b about 220 m east along a road, then c about 330 m
// north through grounds no car enters.
var (
	a, b, c   = [2]float64{135.5, 34.66}, [2]float64{135.5024, 34.66}, [2]float64{135.5024, 34.663}
	spots     = [][2]float64{a, b, c}
	alongRoad = [][2]float64{a, b}
	// sideTrip walks from a to b down a side street and back on the way.
	sideTrip = [][2]float64{a, {135.5, 34.657}, {135.5012, 34.657}, {135.5012, 34.66}, {135.5012, 34.657}, {135.5024, 34.657}, b}
	// grounds walks straight from b to c; roundTheGrounds drives round.
	grounds         = [][2]float64{b, c}
	roundTheGrounds = [][2]float64{b, {135.506, 34.66}, {135.506, 34.663}, c}
)

func TestWalkTakesTheRoadOnlyWhereItDetours(t *testing.T) {
	cars := 0
	cl := detourServer(t, [][][2]float64{sideTrip, grounds}, [][][2]float64{alongRoad, roundTheGrounds}, &cars)
	got, err := cl.Path(t.Context(), "walk", spots)
	if err != nil {
		t.Fatalf("Path() error = %v", err)
	}
	want := [][2]float64{a, b, c}
	if cars != 1 || len(got) != len(want) || got[0] != a || got[1] != b || got[2] != c {
		t.Errorf("Path() = %v after %d road requests, want %v after 1", got, cars, want)
	}
}

func TestWalkKeepsAFootPathWithoutADetour(t *testing.T) {
	cars := 0
	cl := detourServer(t, [][][2]float64{alongRoad, grounds}, [][][2]float64{alongRoad, roundTheGrounds}, &cars)
	got, err := cl.Path(t.Context(), "walk", spots)
	if err != nil {
		t.Fatalf("Path() error = %v", err)
	}
	if cars != 0 || len(got) != 3 {
		t.Errorf("Path() = %v after %d road requests, want the foot path after none", got, cars)
	}
}

func TestWalkKeepsItsDetourWhenTheRoadIsNoShorter(t *testing.T) {
	cars := 0
	cl := detourServer(t, [][][2]float64{sideTrip}, [][][2]float64{sideTrip}, &cars)
	got, err := cl.Path(t.Context(), "walk", alongRoad)
	if err != nil {
		t.Fatalf("Path() error = %v", err)
	}
	if len(got) != len(sideTrip) {
		t.Errorf("Path() = %v, want the foot path", got)
	}
}

func TestCarIsNeverAskedAsAWalk(t *testing.T) {
	cars := 0
	cl := detourServer(t, [][][2]float64{sideTrip}, [][][2]float64{sideTrip}, &cars)
	if _, err := cl.Path(t.Context(), "car", alongRoad); err != nil {
		t.Fatalf("Path() error = %v", err)
	}
	if cars != 0 {
		t.Errorf("asked the road server for a walk %d times, want none", cars)
	}
}
