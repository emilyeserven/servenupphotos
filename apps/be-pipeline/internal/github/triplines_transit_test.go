package github

import (
	"slices"
	"strings"
	"testing"
)

func TestTrimLine(t *testing.T) {
	line := func() *TripTransitLine {
		return &TripTransitLine{ID: 1, Name: " Midosuji Line ", Ref: "M", Colour: "#e5171f"}
	}
	path := [][2]float64{{135.5, 34.66}, {135.49, 34.7}}

	hop := TripSegment{Mode: ModeSubway, Photos: []int{1, 2}, Line: line(), Path: path}
	if perr := trimLine(&hop, 1); perr != nil || hop.Line == nil || hop.Line.Name != "Midosuji Line" || hop.Path == nil {
		t.Errorf("subway with a line: %+v, %v", hop, perr)
	}
	plain := TripSegment{Mode: ModeTrain, Photos: []int{1, 2}, Path: path}
	if _ = trimLine(&plain, 1); plain.Path != nil {
		t.Error("a train with no line kept its path")
	}
	walk := TripSegment{Mode: ModeWalk, Photos: []int{1, 2}, Line: line(), Path: path}
	if _ = trimLine(&walk, 1); walk.Line != nil || walk.Path == nil {
		t.Errorf("walk: line %v, path %v; want no line and the path kept", walk.Line, walk.Path)
	}
	for _, bad := range []TripTransitLine{{ID: 1, Name: " "}, {ID: 1, Name: "X", Colour: "red; x"}} {
		seg := TripSegment{Mode: ModeBus, Photos: []int{1, 2}, Line: &bad}
		if trimLine(&seg, 1) == nil {
			t.Errorf("line %+v passed", bad)
		}
	}
}

func TestBakeTransitLine(t *testing.T) {
	spots := map[int]tripSpot{1: {ID: 1, Day: "2026-10-01", Latitude: 34.66, Longitude: 135.5}, 2: {ID: 2, Day: "2026-10-01", Latitude: 34.7, Longitude: 135.49}}
	track := [][2]float64{{135.5, 34.66}, {135.501, 34.68}, {135.49, 34.7}}
	seg := TripSegment{Mode: ModeSubway, Photos: []int{1, 2}, Line: &TripTransitLine{ID: 1, Name: "Midosuji Line", Ref: "M", Colour: "#e5171f"}, Path: track}
	f, ok := segmentFeature(TripLine{Day: "2026-10-01"}, seg, spots)
	if !ok || len(f.Geometry.Coordinates) != 3 || f.Properties.Line != "Midosuji Line" || f.Properties.Ref != "M" || f.Properties.Colour != "#e5171f" {
		t.Errorf("feature = %+v", f)
	}
}

func TestBakeStationWalks(t *testing.T) {
	spots := map[int]tripSpot{1: {ID: 1, Latitude: 34.66, Longitude: 135.5}, 2: {ID: 2, Latitude: 34.7, Longitude: 135.49}}
	board := &TripPoint{Latitude: 34.665, Longitude: 135.502, Label: "Namba"}
	alight := &TripPoint{Latitude: 34.705, Longitude: 135.495, Label: "Umeda"}
	track := [][2]float64{{135.502, 34.665}, {135.5, 34.68}, {135.495, 34.705}}
	seg := TripSegment{Mode: ModeSubway, Photos: []int{1, 2}, Line: &TripTransitLine{ID: 1, Name: "Midosuji Line"}, Board: board, Alight: alight, Path: track}
	fs := segmentFeatures(TripLine{Day: "2026-10-01"}, seg, spots)
	if len(fs) != 3 {
		t.Fatalf("features = %+v", fs)
	}
	if fs[0].Properties.Mode != ModeWalk || fs[0].Geometry.Coordinates[1] != [2]float64{135.502, 34.665} || fs[0].Properties.Photos[0] != 1 {
		t.Errorf("walk to the station = %+v", fs[0])
	}
	if len(fs[1].Geometry.Coordinates) != 3 || fs[1].Properties.Mode != ModeSubway {
		t.Errorf("ride = %+v", fs[1])
	}
	if fs[2].Geometry.Coordinates[0] != [2]float64{135.495, 34.705} || fs[2].Geometry.Coordinates[1] != [2]float64{135.49, 34.7} || fs[2].Properties.Photos[0] != 2 {
		t.Errorf("walk from the station = %+v", fs[2])
	}
	// Without a line, the stations go.
	plain := TripSegment{Mode: ModeSubway, Photos: []int{1, 2}, Board: board}
	if _ = trimLine(&plain, 1); plain.Board != nil {
		t.Error("a hop with no line kept its station")
	}
}

func TestNamedSegments(t *testing.T) {
	_, c := newMainRepo(t, tripPhotos)
	line := TripLine{ID: "2026-09-23", Segments: []TripSegment{
		{Mode: ModeWalk, Name: "  Morning walk ", Photos: []int{10, 11}},
		{Mode: ModeWalk, Name: strings.Repeat("x", maxEntryTextLength+1), Photos: []int{11, 12}},
	}}
	if _, err := c.SaveTripLine(t.Context(), placesGH, line); err == nil {
		t.Error("a name too long saved")
	}
	line.Segments = line.Segments[:1]
	saved, err := c.SaveTripLine(t.Context(), placesGH, line)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(saved.Data), `"name": "Morning walk"`) {
		t.Errorf("saved = %s", saved.Data)
	}
	spots := map[int]tripSpot{10: {ID: 10, Latitude: 35, Longitude: 135.75}, 11: {ID: 11, Latitude: 35.001, Longitude: 135.751}}
	f, _ := segmentFeature(TripLine{Day: "2026-09-23"}, line.Segments[0], spots)
	if f.Properties.Name == "" {
		t.Errorf("feature name = %q", f.Properties.Name)
	}
}

func TestBakeHopRides(t *testing.T) {
	spots := map[int]tripSpot{1: {ID: 1, Latitude: 35.36, Longitude: 132.76}, 2: {ID: 2, Latitude: 35.39, Longitude: 132.69}}
	first := [][2]float64{{132.76, 35.36}, {132.77, 35.39}}
	second := [][2]float64{{132.77, 35.39}, {132.69, 35.39}}
	seg := TripSegment{
		Mode: ModeTrain, Photos: []int{1, 2}, Path: append(slices.Clone(first), second[1]),
		Line: &TripTransitLine{ID: 7969, Name: "北松江線 → 大社線", Source: "mlit"},
		Rides: []TripLegRide{
			{Line: &TripTransitLine{ID: 31, Name: "北松江線", Source: "mlit"}, Path: first, Change: &TripPoint{Latitude: 35.39, Longitude: 132.77, Label: "川跡"}},
			{Line: &TripTransitLine{ID: 30, Name: "大社線", Source: "mlit"}, Path: second},
		},
	}
	if perr := trimLine(&seg, 1); perr != nil {
		t.Fatal(perr)
	}
	fs := segmentFeatures(TripLine{Day: "2026-11-01"}, seg, spots)
	if len(fs) != 2 || fs[0].Properties.Line != "北松江線" || fs[0].Properties.End != "川跡" || fs[1].Properties.Line != "大社線" || fs[1].Properties.Start != "川跡" {
		t.Fatalf("features = %+v", fs)
	}
	moved := map[int]tripSpot{1: spots[1], 2: {ID: 2, Latitude: 35.5, Longitude: 132.5}}
	if fs := segmentFeatures(TripLine{Day: "2026-11-01"}, seg, moved); len(fs) != 1 {
		t.Errorf("a hop whose photo moved drew %d rides; want one straight line", len(fs))
	}
	seg.Line = nil
	if _ = trimLine(&seg, 1); seg.Rides != nil {
		t.Error("a hop with no line kept its rides")
	}
}
