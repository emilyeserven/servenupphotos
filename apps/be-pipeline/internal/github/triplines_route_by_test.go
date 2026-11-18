package github

import (
	"slices"
	"testing"
)

func TestStretchesBy(t *testing.T) {
	one := 1
	seg := TripSegment{
		Mode:   ModeWalk,
		Photos: []int{1, 2},
		Via: []TripVia{
			{After: &one, By: ViaByRoad},
			{After: &one, By: ViaByRoad},
			{After: &one, By: ViaByFoot},
		},
	}
	spots := map[int]tripSpot{1: {ID: 1}, 2: {ID: 2}}
	// Points: photo 1, road, road, foot, photo 2.
	got := stretchesBy(seg, spots)
	want := []string{ViaByRoad, ViaByRoad, "", ViaByFoot}
	if !slices.Equal(got, want) {
		t.Errorf("stretchesBy() = %q, want %q", got, want)
	}
	points, _ := segmentPoints(seg, spots)
	if len(got) != len(points)-1 {
		t.Errorf("stretchesBy() has %d stretches for %d points", len(got), len(points))
	}
}

func TestValidViaBy(t *testing.T) {
	one := 1
	seg := TripSegment{Mode: ModeWalk, Photos: []int{1, 2}, Via: []TripVia{{After: &one, Latitude: 35, Longitude: 135, By: "bike"}}}
	if validVia(seg, 1) == nil {
		t.Error("validVia() took a via spot going by bike")
	}
	seg.Via[0].By = ViaByRoad
	if perr := validVia(seg, 1); perr != nil {
		t.Errorf("validVia() = %v for a via spot by road", perr)
	}
}
