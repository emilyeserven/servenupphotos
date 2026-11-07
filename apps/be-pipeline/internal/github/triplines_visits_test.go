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

func TestBakeVisits(t *testing.T) {
	spots := map[int]tripSpot{10: {ID: 10, Day: "2026-09-23", Latitude: 35, Longitude: 135.75}, 11: {ID: 11, Day: "2026-09-23", Latitude: 35.001, Longitude: 135.751}}
	line := TripLine{Day: "2026-09-23", Segments: []TripSegment{{Mode: ModeWalk, Photos: []int{10, 11}}}, Visits: []TripVisit{{Name: "Ichiran", Kind: "restaurant", Latitude: 35.0005, Longitude: 135.7505, Link: "https://naver.me/x"}}}
	m := bakeTripLines([]TripLine{line}, spots)
	lines, visits := countFeatures(m)
	if lines != 1 || visits != 1 {
		t.Fatalf("lines %d, visits %d", lines, visits)
	}
	v, ok := m.Features[1].(visitFeature)
	if !ok || v.Geometry.Type != "Point" || v.Geometry.Coordinates != [2]float64{135.7505, 35.0005} || v.Properties.Feature != "visit" || v.Properties.Link != "https://naver.me/x" {
		t.Errorf("pin = %+v", m.Features[1])
	}
}
