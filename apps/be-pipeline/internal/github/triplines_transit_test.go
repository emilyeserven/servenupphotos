package github

import "testing"

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
