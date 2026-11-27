package transit

import "encoding/json"

// geoJSON is a GeoJSON geometry: a line's LineString or MultiLineString, or
// a station's Point, each point [longitude, latitude], as the MLIT and
// Geofabrik files write them.
type geoJSON struct {
	Type        string          `json:"type"`
	Coordinates json.RawMessage `json:"coordinates"`
}

// lines are g's lines: one for a LineString, each for a MultiLineString, and
// none for anything else.
func (g *geoJSON) lines() [][][2]float64 {
	var out [][][2]float64
	switch {
	case g == nil:
	case g.Type == "MultiLineString":
		_ = json.Unmarshal(g.Coordinates, &out)
	case g.Type == "LineString":
		var line [][2]float64
		if json.Unmarshal(g.Coordinates, &line) == nil {
			out = [][][2]float64{line}
		}
	}
	return out
}

// point is g's point when it's a Point.
func (g *geoJSON) point() ([2]float64, bool) {
	var p [2]float64
	if g == nil || g.Type != "Point" || json.Unmarshal(g.Coordinates, &p) != nil {
		return p, false
	}
	return p, true
}

// nearestIndex is the index of the point of line nearest p; 0 with none.
func nearestIndex(line [][2]float64, p [2]float64) int {
	best := 0
	for i, q := range line {
		if meters(p, q) < meters(p, line[best]) {
			best = i
		}
	}
	return best
}
