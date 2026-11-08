package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"
)

func TestTripLineVisits(t *testing.T) {
	_, c := newMainRepo(t, tripPhotos)
	good := TripVisit{Name: " Ichiran ", Kind: "restaurant", Latitude: 35, Longitude: 135.75, Link: "https://maps.app.goo.gl/abc", Note: " Best ramen "}
	line := TripLine{ID: "2026-09-23", Segments: []TripSegment{{Mode: ModeWalk, Photos: []int{10, 11}}}, Visits: []TripVisit{good}}
	saved, err := c.SaveTripLine(t.Context(), placesGH, line)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(saved.Data), `"name": "Ichiran"`) || !strings.Contains(string(saved.Data), `"note": "Best ramen"`) {
		t.Errorf("saved = %s", saved.Data)
	}
	bad := []TripVisit{
		{Name: "", Kind: "restaurant"},
		{Name: "X", Kind: "zoo"},
		{Name: "X", Kind: "cafe", Latitude: 91},
		{Name: "X", Kind: "cafe", Link: "javascript:alert(1)"},
		{Name: "X", Kind: "cafe", Note: strings.Repeat("n", maxNoteLength+1)},
	}
	for i, v := range bad {
		line.Visits = []TripVisit{v}
		_, err := c.SaveTripLine(t.Context(), placesGH, line)
		var perr *PublishError
		if !errors.As(err, &perr) || perr.Status != http.StatusBadRequest {
			t.Errorf("%d: SaveTripLine() error = %v, want 400", i, err)
		}
	}
}

func TestTripLineVisitsOnRoute(t *testing.T) {
	_, c := newMainRepo(t, tripPhotos)
	ten, zero, two := 10, 0, 2
	visit := TripVisit{Name: "Ichiran", Kind: "restaurant", Latitude: 35.0005, Longitude: 135.7505, After: &ten}
	via := TripVia{After: &ten, Latitude: 35.0005, Longitude: 135.7505, Visit: &zero}
	line := TripLine{ID: "2026-09-23", Segments: []TripSegment{{Mode: ModeWalk, Photos: []int{10, 11}, Via: []TripVia{via}}}, Visits: []TripVisit{visit}}
	saved, err := c.SaveTripLine(t.Context(), placesGH, line)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(saved.Data), `"visit": 0`) || !strings.Contains(string(saved.Data), `"after": 10`) {
		t.Errorf("saved = %s", saved.Data)
	}
	auto := TripLine{ID: "2026-09-23", Auto: true, Visits: []TripVisit{visit}}
	if _, err := c.SaveTripLine(t.Context(), placesGH, auto); err != nil {
		t.Errorf("auto line with a stop after one of its photos: error = %v", err)
	}
	stray := 99
	for name, change := range map[string]func(l *TripLine){
		"after a photo off the line": func(l *TripLine) { l.Visits[0].After = &stray },
		"via for a missing visit":    func(l *TripLine) { l.Segments[0].Via[0].Visit = &two },
	} {
		bad := line
		bad.Visits = []TripVisit{visit}
		bad.Segments = []TripSegment{{Mode: ModeWalk, Photos: []int{10, 11}, Via: []TripVia{via}}}
		change(&bad)
		_, err := c.SaveTripLine(t.Context(), placesGH, bad)
		var perr *PublishError
		if !errors.As(err, &perr) || perr.Status != http.StatusBadRequest {
			t.Errorf("%s: SaveTripLine() error = %v, want 400", name, err)
		}
	}
}

func TestBakeVisits(t *testing.T) {
	spots := map[int]tripSpot{10: {ID: 10, Day: "2026-09-23", Latitude: 35, Longitude: 135.75}, 11: {ID: 11, Day: "2026-09-23", Latitude: 35.001, Longitude: 135.751}}
	line := TripLine{Day: "2026-09-23", Segments: []TripSegment{{Mode: ModeWalk, Photos: []int{10, 11}}}, Visits: []TripVisit{{Name: "Ichiran", Kind: "restaurant", Latitude: 35.0005, Longitude: 135.7505, Link: "https://naver.me/x"}}}
	m := bakeTripLines([]TripLine{line}, spots)
	if c := featureCounts(m); c["tripLineSegments"] != 1 || c["tripLineVisits"] != 1 {
		t.Fatalf("counts %v", c)
	}
	v, ok := m.Features[1].(visitFeature)
	if !ok || v.Geometry.Type != "Point" || v.Geometry.Coordinates != [2]float64{135.7505, 35.0005} || v.Properties.Feature != "visit" || v.Properties.Link != "https://naver.me/x" {
		t.Errorf("pin = %+v", m.Features[1])
	}
}
