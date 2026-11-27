package transit

import "encoding/json"

// geoJSON is a GeoJSON geometry, such as a line's LineString or
// MultiLineString, each point [longitude, latitude], as the MLIT and
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
