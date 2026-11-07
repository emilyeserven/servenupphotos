package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/areas"
)

// square is a small closed outline near the test photos.
var square = areas.Shape{{{{135.7, 35}, {135.8, 35}, {135.8, 35.1}, {135.7, 35}}}}

func TestTripLineFences(t *testing.T) {
	_, c := newMainRepo(t, tripPhotos)
	good := TripFence{Name: " Castle Park ", Photos: []int{14}, OSM: "R1", Shape: square}
	line := TripLine{ID: "2026-09-23", Segments: []TripSegment{{Mode: ModeWalk, Photos: []int{10, 11}}}, Fences: []TripFence{good}}
	saved, err := c.SaveTripLine(t.Context(), placesGH, line)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(saved.Data), `"name": "Castle Park"`) || !strings.Contains(string(saved.Data), `"osm": "R1"`) {
		t.Errorf("saved = %s", saved.Data)
	}
	open := areas.Shape{{{{135.7, 35}, {135.8, 35}, {135.8, 35.1}, {135.7, 35.1}}}}
	bad := map[string]TripFence{
		"no name":            {Photos: []int{14}, Shape: square},
		"no photos":          {Name: "X", Shape: square},
		"photo from another": {Name: "X", Photos: []int{13}, Shape: square},
		"unknown photo":      {Name: "X", Photos: []int{99}, Shape: square},
		"no outline":         {Name: "X", Photos: []int{14}},
		"ring not closed":    {Name: "X", Photos: []int{14}, Shape: open},
	}
	for name, f := range bad {
		line.Fences = []TripFence{f}
		_, err := c.SaveTripLine(t.Context(), placesGH, line)
		var perr *PublishError
		if !errors.As(err, &perr) || perr.Status != http.StatusBadRequest {
			t.Errorf("%s: SaveTripLine() error = %v, want 400", name, err)
		}
	}
}

func TestBakeFences(t *testing.T) {
	spots := map[int]tripSpot{10: {ID: 10, Day: "2026-09-23", Latitude: 35, Longitude: 135.75}, 11: {ID: 11, Day: "2026-09-23", Latitude: 35.001, Longitude: 135.751}}
	line := TripLine{Day: "2026-09-23", Segments: []TripSegment{{Mode: ModeWalk, Photos: []int{10, 11}}}, Fences: []TripFence{{Name: "Castle Park", Photos: []int{14}, Shape: square}}}
	m := bakeTripLines([]TripLine{line}, spots)
	if c := featureCounts(m); c["tripLineSegments"] != 1 || c["tripLineFences"] != 1 {
		t.Fatalf("counts %v", c)
	}
	f, ok := m.Features[1].(fenceFeature)
	if !ok || f.Geometry.Type != "MultiPolygon" || f.Properties.Feature != "fence" || f.Properties.Name != "Castle Park" || f.Properties.Photos[0] != 14 {
		t.Errorf("fence = %+v", m.Features[1])
	}
}
