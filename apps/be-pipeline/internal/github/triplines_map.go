package github

import (
	"encoding/json"
	"maps"
	"math"
	"net/http"
)

// TripLinesMapFile is the trip lines baked for the portfolio's map: every
// segment of every day as a GeoJSON line with its photos' spots filled in, so
// the portfolio draws it as it is. Commit makes it in the trip lines folder,
// next to TRIPLINES.json.
const TripLinesMapFile = "TRIPLINES.geo.json"

// tripLinesMap is TripLinesMapFile: a GeoJSON FeatureCollection of the
// segments' lines (tripLineFeature), the places visited's pins
// (visitFeature) and the areas photos were taken in (fenceFeature).
type tripLinesMap struct {
	Type     string `json:"type"`
	Features []any  `json:"features"`
}

// tripLineFeature is one segment of a day as a GeoJSON line.
type tripLineFeature struct {
	Type       string           `json:"type"`
	Geometry   tripLineGeometry `json:"geometry"`
	Properties tripLineProps    `json:"properties"`
}

// tripLineGeometry is a GeoJSON LineString: [longitude, latitude] pairs.
type tripLineGeometry struct {
	Type        string       `json:"type"`
	Coordinates [][2]float64 `json:"coordinates"`
}

// tripLineProps say what a line is: its day and mode, the photos it goes
// through, how long it is, the labels of its spots with no photo, and the
// transit line it rode.
type tripLineProps struct {
	Day  string `json:"day"`
	Mode string `json:"mode"`
	// Trip is the ID of the Trip a leg between days is part of, and Arrive
	// the day it arrived; both "" for a day's own line.
	Trip   string `json:"trip,omitempty"`
	Arrive string `json:"arrive,omitempty"`
	// Name names the line of the day the segment is part of; "" for none.
	Name   string  `json:"name,omitempty"`
	Auto   bool    `json:"auto"`
	Photos []int   `json:"photos"`
	Km     float64 `json:"km"`
	Start  string  `json:"start,omitempty"`
	End    string  `json:"end,omitempty"`
	// Line names the bus, subway or train line a hop rode, Ref is its number
	// and Colour its color; all "" when none was picked.
	Line   string `json:"line,omitempty"`
	Ref    string `json:"ref,omitempty"`
	Colour string `json:"colour,omitempty"`
}

// addTripLinesMap bakes TripLinesMapFile from the trip line and photo files
// with changes made, adds it to changes when it differs from the one at the
// head, and counts its lines in counts. Only photos on the portfolio are
// drawn.
func (w *workspace) addTripLinesMap(changes map[string][]byte, counts map[string]int) *PublishError {
	view := w.withChanges(changes)
	spots := view.tripSpots(true)
	m := bakeTripLines(view.tripLineFiles(), spots)
	m.Features = append(m.Features, bakeTrips(view.allTrips(), spots)...)
	b, err := json.Marshal(m)
	if err != nil {
		return publishErr(http.StatusInternalServerError, "Couldn't format %s.", TripLinesMapFile)
	}
	content := formatJSONFile(b)
	maps.Copy(counts, featureCounts(m))
	file := w.root + "/" + TripLines.Folder + "/" + TripLinesMapFile
	if old, ok := w.head.files[file]; !ok || old.sha != blobSHA(content) {
		changes[file] = content
	}
	return nil
}

// tripLineFiles is every trip line file in w that can be read, by path.
func (w *workspace) tripLineFiles() []TripLine {
	var out []TripLine
	for _, e := range w.entries(TripLines) {
		var line TripLine
		if e.Error == "" && json.Unmarshal(e.Data, &line) == nil && line.Day != "" {
			out = append(out, line)
		}
	}
	return out
}

// bakeTripLines is the map of lines: each line's segments, or its automatic
// ones, drawn through spots. A photo not in spots is skipped, and a segment
// left with fewer than two points isn't drawn.
func bakeTripLines(lines []TripLine, spots map[int]tripSpot) tripLinesMap {
	m := tripLinesMap{Type: "FeatureCollection", Features: []any{}}
	for _, line := range lines {
		day := onDay(spots, line.Day)
		segments := line.Segments
		if line.Auto {
			segments = autoSegments(spotsOn(day, line.Day))
		}
		for _, seg := range segments {
			for _, f := range segmentFeatures(line, seg, day) {
				m.Features = append(m.Features, f)
			}
		}
		for _, v := range line.Visits {
			m.Features = append(m.Features, visitFeatureOf(line.Day, v))
		}
		for _, f := range line.Fences {
			m.Features = append(m.Features, fenceFeatureOf(line.Day, f))
		}
	}
	return m
}

// segmentFeature is seg of line, through spots taken that day, as a GeoJSON line: along its path when it
// has one that still fits its points, or else straight through them. False
// when it has fewer than two points to draw.
func segmentFeature(line TripLine, seg TripSegment, spots map[int]tripSpot) (tripLineFeature, bool) {
	coords, photos := segmentPoints(seg, spots)
	if len(coords) < 2 {
		return tripLineFeature{}, false
	}
	coords = rideEnds(seg, coords)
	if pathFits(seg.Path, coords) {
		coords = seg.Path
	}
	props := tripLineProps{Day: line.Day, Mode: seg.Mode, Name: seg.Name, Auto: line.Auto, Photos: photos, Km: lineKm(coords)}
	props.Start, props.End = labelOf(seg.Start), labelOf(seg.End)
	props.Line, props.Ref, props.Colour = lineProps(seg.Line)
	return tripLineFeature{Type: "Feature", Geometry: tripLineGeometry{Type: "LineString", Coordinates: coords}, Properties: props}, true
}

// labelOf is p's label, or "" when there's no p.
func labelOf(p *TripPoint) string {
	if p == nil {
		return ""
	}
	return p.Label
}

// onDay is the spots taken on day.
func onDay(spots map[int]tripSpot, day string) map[int]tripSpot {
	out := map[int]tripSpot{}
	for id, s := range spots {
		if s.Day == day {
			out[id] = s
		}
	}
	return out
}

// lineKm is how long the line through coords is, to the nearest 0.1 km.
func lineKm(coords [][2]float64) float64 {
	km := 0.0
	for i := 1; i < len(coords); i++ {
		km += distanceKm(coords[i-1][1], coords[i-1][0], coords[i][1], coords[i][0])
	}
	return math.Round(km*10) / 10
}
