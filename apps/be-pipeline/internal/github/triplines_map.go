package github

import (
	"encoding/json"
	"math"
	"net/http"
)

// TripLinesMapFile is the trip lines baked for the portfolio's map: every
// segment of every day as a GeoJSON line with its photos' spots filled in, so
// the portfolio draws it as it is. Commit makes it in the trip lines folder,
// next to TRIPLINES.json.
const TripLinesMapFile = "TRIPLINES.geo.json"

// tripLinesMap is TripLinesMapFile: a GeoJSON FeatureCollection.
type tripLinesMap struct {
	Type     string            `json:"type"`
	Features []tripLineFeature `json:"features"`
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
// through, how long it is, and the labels of its spots with no photo.
type tripLineProps struct {
	Day    string  `json:"day"`
	Mode   string  `json:"mode"`
	Auto   bool    `json:"auto"`
	Photos []int   `json:"photos"`
	Km     float64 `json:"km"`
	Start  string  `json:"start,omitempty"`
	End    string  `json:"end,omitempty"`
}

// addTripLinesMap bakes TripLinesMapFile from the trip line and photo files
// with changes made, adds it to changes when it differs from the one at the
// head, and counts its lines in counts. Only photos on the portfolio are
// drawn.
func (w *workspace) addTripLinesMap(changes map[string][]byte, counts map[string]int) *PublishError {
	view := w.withChanges(changes)
	m := bakeTripLines(view.tripLineFiles(), view.tripSpots(true))
	b, err := json.Marshal(m)
	if err != nil {
		return publishErr(http.StatusInternalServerError, "Couldn't format %s.", TripLinesMapFile)
	}
	content := formatJSONFile(b)
	counts["tripLineSegments"] = len(m.Features)
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
	m := tripLinesMap{Type: "FeatureCollection", Features: []tripLineFeature{}}
	for _, line := range lines {
		segments := line.Segments
		if line.Auto {
			segments = autoSegments(spotsOn(spots, line.Day))
		}
		for _, seg := range segments {
			if f, ok := segmentFeature(line, seg, spots); ok {
				m.Features = append(m.Features, f)
			}
		}
	}
	return m
}

// segmentFeature is seg of line as a GeoJSON line, and false when it has
// fewer than two points to draw.
func segmentFeature(line TripLine, seg TripSegment, spots map[int]tripSpot) (tripLineFeature, bool) {
	props := tripLineProps{Day: line.Day, Mode: seg.Mode, Auto: line.Auto, Photos: []int{}}
	var coords [][2]float64
	if seg.Start != nil {
		coords = append(coords, [2]float64{seg.Start.Longitude, seg.Start.Latitude})
		props.Start = seg.Start.Label
	}
	for _, id := range seg.Photos {
		if s, ok := spots[id]; ok && s.Day == line.Day {
			coords = append(coords, [2]float64{s.Longitude, s.Latitude})
			props.Photos = append(props.Photos, id)
		}
	}
	if seg.End != nil {
		coords = append(coords, [2]float64{seg.End.Longitude, seg.End.Latitude})
		props.End = seg.End.Label
	}
	if len(coords) < 2 {
		return tripLineFeature{}, false
	}
	props.Km = lineKm(coords)
	return tripLineFeature{Type: "Feature", Geometry: tripLineGeometry{Type: "LineString", Coordinates: coords}, Properties: props}, true
}

// lineKm is how long the line through coords is, to the nearest 0.1 km.
func lineKm(coords [][2]float64) float64 {
	km := 0.0
	for i := 1; i < len(coords); i++ {
		km += distanceKm(coords[i-1][1], coords[i-1][0], coords[i][1], coords[i][0])
	}
	return math.Round(km*10) / 10
}
