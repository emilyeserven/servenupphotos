package github

import (
	"errors"
	"net/http"
	"slices"
	"strings"
	"testing"
	"time"
)

// emptyTripLinesMap is TripLinesMapFile with no trip lines.
const emptyTripLinesMap = "{\n  \"type\": \"FeatureCollection\",\n  \"features\": []\n}\n"

// tripPhotos are photo files for the trip line tests: three on Sep 23 with a
// spot (12 by a place marked as an exact location), one on Sep 24, and one
// with no spot.
var tripPhotos = map[string]string{
	dataRoot + "/photos/a.json":         `{"id":10,"title":"A","createDate":"2026:09:23 09:00:00","gpsPosition":"35 deg 0' 0.00\" N, 135 deg 45' 0.00\" E"}`,
	dataRoot + "/photos/b.json":         `{"id":11,"title":"B","createDate":"2026:09:23 09:20:00","customGpsPosition":"35.001, 135.751"}`,
	dataRoot + "/photos/c.json":         `{"id":12,"title":"C","createDate":"2026:09:23 09:40:00","places":[{"id":"station","relation":"at"}]}`,
	dataRoot + "/photos/d.json":         `{"id":13,"title":"D","createDate":"2026:09:24 10:00:00","gpsPosition":"35.1, 135.8"}`,
	dataRoot + "/photos/e.json":         `{"id":14,"title":"E","createDate":"2026:09:23 11:00:00"}`,
	dataRoot + "/places/station.json":   `{"id":"station","name":"Station","latitude":35.1,"longitude":135.9,"exactLocation":true}`,
	dataRoot + "/places/vaguely.json":   `{"id":"vaguely","name":"Vaguely","latitude":35.1,"longitude":135.9}`,
	dataRoot + "/photos/ALLPHOTOS.json": "[]\n",
}

func TestSaveTripLine(t *testing.T) {
	_, c := newMainRepo(t, tripPhotos)
	line := TripLine{ID: "2026-09-23", Segments: []TripSegment{
		{Mode: ModeWalk, Start: &TripPoint{Latitude: 35, Longitude: 135.7, Label: " Hotel "}, Photos: []int{10, 11}},
		{Mode: ModeSubway, Photos: []int{11, 12}},
	}}
	if _, err := c.SaveTripLine(t.Context(), placesGH, line); err != nil {
		t.Fatalf("SaveTripLine() error = %v", err)
	}
	saved := staged(t, c, dataRoot+"/triplines/2026-09-23.json")
	if !strings.Contains(saved, `"day": "2026-09-23"`) || !strings.Contains(saved, `"label": "Hotel"`) {
		t.Errorf("saved %s", saved)
	}
	tests := []struct {
		name string
		line TripLine
	}{
		{"not a day", TripLine{ID: "sept-23", Segments: []TripSegment{{Mode: ModeWalk, Photos: []int{10, 11}}}}},
		{"bad mode", TripLine{ID: "2026-09-23", Segments: []TripSegment{{Mode: "boat", Photos: []int{10, 11}}}}},
		{"one point", TripLine{ID: "2026-09-23", Segments: []TripSegment{{Mode: ModeWalk, Photos: []int{10}}}}},
		{"twice", TripLine{ID: "2026-09-23", Segments: []TripSegment{{Mode: ModeWalk, Photos: []int{10, 10}}}}},
		{"other day", TripLine{ID: "2026-09-23", Segments: []TripSegment{{Mode: ModeWalk, Photos: []int{10, 13}}}}},
		{"no spot", TripLine{ID: "2026-09-23", Segments: []TripSegment{{Mode: ModeWalk, Photos: []int{10, 14}}}}},
		{"off the map", TripLine{ID: "2026-09-23", Segments: []TripSegment{{Mode: ModeWalk, Photos: []int{10}, End: &TripPoint{Latitude: 91}}}}},
	}
	for _, tt := range tests {
		_, err := c.SaveTripLine(t.Context(), placesGH, tt.line)
		var perr *PublishError
		if !errors.As(err, &perr) || perr.Status != http.StatusBadRequest {
			t.Errorf("%s: SaveTripLine() error = %v, want 400", tt.name, err)
		}
	}
	// The automatic line saves with no segments.
	if _, err := c.SaveTripLine(t.Context(), placesGH, TripLine{ID: "2026-09-24", Auto: true, Segments: line.Segments}); err != nil {
		t.Fatalf("auto: SaveTripLine() error = %v", err)
	}
	if saved := staged(t, c, dataRoot+"/triplines/2026-09-24.json"); !strings.Contains(saved, `"segments": []`) {
		t.Errorf("auto saved %s", saved)
	}
}

func TestAutoSegments(t *testing.T) {
	at := func(id int, minutes, lat, lng float64) tripSpot {
		return tripSpot{ID: id, Taken: time.Date(2026, 9, 23, 9, 0, 0, 0, time.UTC).Add(time.Duration(minutes) * time.Minute), Latitude: lat, Longitude: lng}
	}
	spots := []tripSpot{
		at(1, 0, 35, 135),
		at(2, 10, 35.002, 135), // about 0.2 km in 10 minutes: walking
		at(3, 20, 35.004, 135),
		at(4, 30, 35.1, 135),    // about 10 km in 10 minutes: a hop
		at(5, 40, 35.101, 135),  // walking again
		at(6, 300, 35.102, 135), // hours later: a break
		at(7, 310, 35.103, 135),
	}
	got := autoSegments(spots)
	want := []TripSegment{
		{Mode: ModeWalk, Photos: []int{1, 2, 3}},
		{Mode: ModeTransit, Photos: []int{3, 4}},
		{Mode: ModeWalk, Photos: []int{4, 5}},
		{Mode: ModeWalk, Photos: []int{6, 7}},
	}
	if len(got) != len(want) {
		t.Fatalf("autoSegments() = %+v, want %+v", got, want)
	}
	for i := range want {
		if got[i].Mode != want[i].Mode || !slices.Equal(got[i].Photos, want[i].Photos) {
			t.Errorf("segment %d = %+v, want %+v", i, got[i], want[i])
		}
	}
}

func TestCommitCombinedBakesTripLines(t *testing.T) {
	f, c := newMainRepo(t, with(emptyLists, tripPhotos))
	line := TripLine{ID: "2026-09-23", Segments: []TripSegment{
		{Mode: ModeWalk, Start: &TripPoint{Latitude: 35, Longitude: 135.7, Label: "Hotel"}, Photos: []int{10, 11}},
		{Mode: ModeSubway, Photos: []int{11, 12}},
	}}
	if _, err := c.SaveTripLine(t.Context(), placesGH, line); err != nil {
		t.Fatalf("SaveTripLine() error = %v", err)
	}
	if _, err := c.SaveTripLine(t.Context(), placesGH, TripLine{ID: "2026-09-24", Auto: true}); err != nil {
		t.Fatalf("auto: SaveTripLine() error = %v", err)
	}
	got, err := c.CommitCombined(t.Context(), pullGH, nil)
	if err != nil {
		t.Fatalf("CommitCombined() error = %v", err)
	}
	// Sep 24 has one photo, so its automatic line has nothing to draw.
	if got.Counts["triplines"] != 2 || got.Counts["tripLineSegments"] != 2 {
		t.Errorf("counts = %v", got.Counts)
	}
	baked := f.committedTree()[dataRoot+"/triplines/"+TripLinesMapFile]
	for _, want := range []string{`"mode": "walk"`, `"start": "Hotel"`, `"mode": "subway"`, `[135.9, 35.1]`, `"photos": [11, 12]`} {
		if !strings.Contains(baked, want) {
			t.Errorf("baked map has no %s:\n%s", want, baked)
		}
	}
}

func TestParseGPS(t *testing.T) {
	for in, want := range map[string]TripPoint{
		`51 deg 24' 46.80" N, 116 deg 12' 59.51" W`: {Latitude: 51.4130, Longitude: -116.2165},
		"40.7795, -73.9634":                         {Latitude: 40.7795, Longitude: -73.9634},
	} {
		got, ok := parseGPS(&in)
		if !ok || abs(got.Latitude-want.Latitude) > 1e-3 || abs(got.Longitude-want.Longitude) > 1e-3 {
			t.Errorf("parseGPS(%q) = %+v, %v; want %+v", in, got, ok, want)
		}
	}
	for _, in := range []string{"", "somewhere", "1, 2, 3"} {
		if _, ok := parseGPS(&in); ok {
			t.Errorf("parseGPS(%q) read a position", in)
		}
	}
}

func abs(f float64) float64 {
	if f < 0 {
		return -f
	}
	return f
}
