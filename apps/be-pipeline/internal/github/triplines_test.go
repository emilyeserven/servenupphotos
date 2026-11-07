package github

import (
	"context"
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
		at(8, 400, 35.403, 135), // about 33 km, hours later: a drive
	}
	got := autoSegments(spots)
	want := []TripSegment{
		{Mode: ModeWalk, Photos: []int{1, 2, 3}},
		{Mode: ModeTransit, Photos: []int{3, 4}},
		{Mode: ModeWalk, Photos: []int{4, 5}},
		{Mode: ModeWalk, Photos: []int{6, 7}},
		{Mode: ModeCar, Photos: []int{7, 8}},
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

func TestRouteTripLine(t *testing.T) {
	f, c := newMainRepo(t, with(emptyLists, tripPhotos))
	var asked [][][2]float64
	var modes []string
	route := func(_ context.Context, mode string, points [][2]float64) ([][2]float64, error) {
		modes = append(modes, mode)
		asked = append(asked, points)
		if mode == ModeCar {
			return nil, errors.New("no route")
		}
		mid := [2]float64{135.7123456789, 35.0005}
		return [][2]float64{points[0], mid, points[len(points)-1]}, nil
	}
	ten := 10
	line := TripLine{ID: "2026-09-23", Segments: []TripSegment{
		{Mode: ModeWalk, Photos: []int{10, 11}, Via: []TripVia{{After: &ten, Latitude: 35.0004, Longitude: 135.7505}}},
		{Mode: ModeSubway, Photos: []int{11, 12}, Path: [][2]float64{{1, 1}, {2, 2}}},
		{Mode: ModeCar, Photos: []int{12}, End: &TripPoint{Latitude: 35.2, Longitude: 135.9}},
	}}
	got, err := c.RouteTripLine(t.Context(), placesGH, line, route)
	if err != nil {
		t.Fatalf("RouteTripLine() error = %v", err)
	}
	// The subway isn't routed, and its path is dropped; the car found none.
	if got.Unrouted != 1 || !slices.Equal(modes, []string{ModeWalk, ModeCar}) {
		t.Errorf("unrouted = %d, asked %v", got.Unrouted, modes)
	}
	// The walk is routed through its via spot, between its two photos.
	if len(asked[0]) != 3 || asked[0][1] != [2]float64{135.7505, 35.0004} {
		t.Errorf("walk routed through %v", asked[0])
	}
	if got.Line.Segments[1].Path != nil || len(got.Line.Segments[0].Path) != 3 {
		t.Errorf("routed %+v", got.Line.Segments)
	}
	// Nothing is saved until the routed line is.
	if _, ok := stagedContent(t, c, dataRoot+"/triplines/2026-09-23.json"); ok {
		t.Error("RouteTripLine() saved the line")
	}
	if _, err := c.SaveTripLine(t.Context(), placesGH, got.Line); err != nil {
		t.Fatalf("SaveTripLine() error = %v", err)
	}
	if _, err := c.CommitCombined(t.Context(), pullGH, nil); err != nil {
		t.Fatalf("CommitCombined() error = %v", err)
	}
	baked := f.committedTree()[dataRoot+"/triplines/"+TripLinesMapFile]
	// The walk follows its path; the car, with none, goes straight to its end.
	for _, want := range []string{"135.712346", "[135.9, 35.2]"} {
		if !strings.Contains(baked, want) {
			t.Errorf("baked map has no %s:\n%s", want, baked)
		}
	}
}

func TestTripLineVia(t *testing.T) {
	_, c := newMainRepo(t, tripPhotos)
	nine := 9
	bad := []TripSegment{
		{Mode: ModeWalk, Photos: []int{10, 11}, Via: []TripVia{{After: &nine, Latitude: 35, Longitude: 135}}},
		{Mode: ModeWalk, Photos: []int{10, 11}, Via: []TripVia{{Latitude: 35, Longitude: 135}}},
	}
	for i, seg := range bad {
		_, err := c.SaveTripLine(t.Context(), placesGH, TripLine{ID: "2026-09-23", Segments: []TripSegment{seg}})
		var perr *PublishError
		if !errors.As(err, &perr) || perr.Status != http.StatusBadRequest {
			t.Errorf("%d: SaveTripLine() error = %v, want 400", i, err)
		}
	}
	// A via spot after the start counts as a point, so start, via and one photo make a line.
	seg := TripSegment{Mode: ModeWalk, Start: &TripPoint{Latitude: 35, Longitude: 135.7}, Via: []TripVia{{Latitude: 35, Longitude: 135.72}}, Photos: []int{10}}
	points, _ := segmentPoints(seg, map[int]tripSpot{10: {ID: 10, Latitude: 35, Longitude: 135.75}})
	if len(points) != 3 || points[1] != [2]float64{135.72, 35} {
		t.Errorf("segmentPoints() = %v", points)
	}
}

func TestPathFits(t *testing.T) {
	coords := [][2]float64{{135.75, 35}, {135.751, 35.001}}
	if !pathFits([][2]float64{{135.7501, 35}, {135.76, 35.01}, {135.751, 35.0011}}, coords) {
		t.Error("a path from the first point to the last doesn't fit")
	}
	// A photo moved about 1 km since the path was found.
	if pathFits([][2]float64{{135.75, 35}, {135.751, 35.01}}, coords) {
		t.Error("a path ending 1 km away fits")
	}
}

func TestWanderAndAreaEnds(t *testing.T) {
	spots := map[int]tripSpot{
		1: {ID: 1, Day: "2026-09-23", Latitude: 35, Longitude: 135.70},
		2: {ID: 2, Day: "2026-09-23", Latitude: 35, Longitude: 135.71},
		3: {ID: 3, Day: "2026-09-23", Latitude: 35, Longitude: 135.80},
	}
	exit := &TripPoint{Latitude: 35.01, Longitude: 135.72}
	entrance := &TripPoint{Latitude: 35.02, Longitude: 135.79}
	line := TripLine{Day: "2026-09-23", Segments: []TripSegment{
		{Mode: ModeWander, Photos: []int{1, 2}},
		{Mode: ModeWalk, Photos: []int{2, 3}, From: exit, To: entrance},
	}}
	m := bakeTripLines([]TripLine{line}, spots)
	if len(m.Features) != 1 {
		t.Fatalf("features = %d, want 1: the wander draws no line", len(m.Features))
	}
	got := m.Features[0].(tripLineFeature).Geometry.Coordinates
	if len(got) != 2 || got[0] != [2]float64{135.72, 35.01} || got[1] != [2]float64{135.79, 35.02} {
		t.Errorf("coordinates = %v, want the exit then the entrance", got)
	}
}
