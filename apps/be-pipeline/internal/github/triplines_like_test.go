package github

import (
	"context"
	"slices"
	"testing"
)

func TestTrimLineLike(t *testing.T) {
	path := [][2]float64{{135.5, 34.66}, {135.49, 34.7}}
	car := TripSegment{Mode: ModeTransit, Like: ModeCar, Photos: []int{1, 2}, Path: path}
	if _ = trimLine(&car, 1); car.Like != ModeCar || car.Path == nil {
		t.Errorf("transit like a car: like %q, path %v; want both kept", car.Like, car.Path)
	}
	plain := TripSegment{Mode: ModeTransit, Photos: []int{1, 2}, Path: path}
	if _ = trimLine(&plain, 1); plain.Path != nil {
		t.Error("a transit hop drawn as one kept its path")
	}
	for _, seg := range []TripSegment{
		{Mode: ModeTrain, Like: ModeCar, Photos: []int{1, 2}, Path: path},
		{Mode: ModeTransit, Like: ModeSubway, Photos: []int{1, 2}, Path: path},
	} {
		if _ = trimLine(&seg, 1); seg.Like != "" || seg.Path != nil {
			t.Errorf("%s like %s: kept like %q, path %v", seg.Mode, seg.Like, seg.Like, seg.Path)
		}
	}
}

func TestWayMode(t *testing.T) {
	found := &TripTransitLine{ID: 1, Name: "Bus 7"}
	named := &TripTransitLine{Name: "Super HAGI", Source: "named"}
	for _, c := range []struct {
		seg  TripSegment
		want string
	}{
		{TripSegment{Mode: ModeTransit, Like: ModeCar}, ModeCar},
		{TripSegment{Mode: ModeTransit, Like: ModeBus, Line: named}, ModeBus},
		{TripSegment{Mode: ModeTransit, Like: ModeCar, Line: found}, ModeTransit},
		{TripSegment{Mode: ModeTransit}, ModeTransit},
		{TripSegment{Mode: ModeTrain, Like: ModeCar}, ModeTrain},
	} {
		if got := wayMode(c.seg); got != c.want {
			t.Errorf("wayMode(%+v) = %q, want %q", c.seg, got, c.want)
		}
	}
}

func TestRouteTransitLikeCar(t *testing.T) {
	spots := map[int]tripSpot{1: {ID: 1, Day: "2026-10-01", Latitude: 34.9, Longitude: 134.8}, 2: {ID: 2, Day: "2026-10-01", Latitude: 34.91, Longitude: 134.81}}
	var modes []string
	route := func(_ context.Context, mode string, points [][2]float64, _ []string) ([][2]float64, error) {
		modes = append(modes, mode)
		return [][2]float64{points[0], {134.805, 34.9}, points[len(points)-1]}, nil
	}
	line := TripLine{Day: "2026-10-01", Segments: []TripSegment{
		{Mode: ModeTransit, Like: ModeCar, Photos: []int{1, 2}},
		{Mode: ModeTransit, Photos: []int{2, 1}},
	}}
	if unrouted := routeSegments(t.Context(), line, spots, route); unrouted != 0 || !slices.Equal(modes, []string{ModeCar}) {
		t.Fatalf("unrouted %d, routed as %v; want the car-like hop routed by car alone", unrouted, modes)
	}
	f, ok := segmentFeature(line, line.Segments[0], spots)
	if !ok || f.Properties.Mode != ModeCar || len(f.Geometry.Coordinates) != 3 {
		t.Errorf("baked %+v; want a car line along its path", f)
	}
	if f, _ := segmentFeature(line, line.Segments[1], spots); f.Properties.Mode != ModeTransit {
		t.Errorf("plain transit baked as %q", f.Properties.Mode)
	}
}
