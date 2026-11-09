package github

import (
	"context"
	"testing"
)

func TestRouteStationWalks(t *testing.T) {
	spots := map[int]tripSpot{1: {ID: 1, Latitude: 37.80, Longitude: -122.42}, 2: {ID: 2, Latitude: 37.805, Longitude: -122.45}}
	stop := &TripPoint{Latitude: 37.80, Longitude: -122.44, Label: "Broderick St & Francisco St"}
	seg := TripSegment{Mode: ModeBus, Photos: []int{1, 2}, Line: &TripTransitLine{ID: 1, Name: "30"}, Alight: stop,
		AlightWalk: &StationWalk{Via: []TripPoint{{Latitude: 37.803, Longitude: -122.445}}}}
	var asked [][2]float64
	route := func(_ context.Context, mode string, points [][2]float64) ([][2]float64, error) {
		asked = points
		return points, nil
	}
	if unrouted := routeStationWalks(context.Background(), &seg, spots, route); unrouted != 0 {
		t.Fatalf("unrouted = %d", unrouted)
	}
	if len(asked) != 3 || asked[0] != [2]float64{-122.44, 37.80} || asked[2] != [2]float64{-122.45, 37.805} {
		t.Errorf("asked to route %v, want the stop, the via spot, then photo 2", asked)
	}
	if seg.BoardWalk != nil || len(seg.AlightWalk.Path) != 3 {
		t.Errorf("walks = %+v, %+v", seg.BoardWalk, seg.AlightWalk)
	}
	feats := segmentFeatures(TripLine{Day: "2026-10-24"}, seg, spots)
	if len(feats) != 2 || len(feats[1].Geometry.Coordinates) != 3 {
		t.Errorf("features = %+v", feats)
	}
}

func TestTrimStationWalks(t *testing.T) {
	seg := TripSegment{Mode: ModeBus, Line: &TripTransitLine{ID: 1, Name: "30"}, BoardWalk: &StationWalk{Via: []TripPoint{{Latitude: 1}}}}
	if perr := trimLine(&seg, 1); perr != nil || seg.BoardWalk != nil {
		t.Errorf("a walk to no station was kept: %v, %+v", perr, seg.BoardWalk)
	}
	seg.Alight = &TripPoint{Latitude: 37.8, Longitude: -122.44}
	seg.AlightWalk = &StationWalk{Via: []TripPoint{{Latitude: 99}}}
	if perr := trimLine(&seg, 2); perr == nil {
		t.Error("a via spot off the map was kept")
	}
}
