package github

import "testing"

func TestWithStopVias(t *testing.T) {
	ten, eleven, twelve := 10, 11, 12
	segments := []TripSegment{{Mode: ModeWalk, Photos: []int{10, 11}}, {Mode: ModeTransit, Photos: []int{11, 12}}}
	visits := []TripVisit{
		{Name: "Off the route", Kind: "cafe"},
		{Name: "Ramen", Kind: "restaurant", Latitude: 35, Longitude: 135, After: &ten},
		{Name: "At the walk's end", Kind: "shop", After: &eleven},
		{Name: "Last photo", Kind: "sight", After: &twelve},
	}
	got := withStopVias(segments, visits)
	if len(got[0].Via) != 1 || *got[0].Via[0].Visit != 1 || *got[0].Via[0].After != 10 || got[0].Via[0].Latitude != 35 {
		t.Errorf("walk vias = %+v, want the ramen stop after photo 10", got[0].Via)
	}
	if len(got[1].Via) != 0 {
		t.Errorf("hop vias = %+v, want none", got[1].Via)
	}
}
