package github

import (
	"net/http"
	"regexp"
	"slices"
	"strings"
	"unicode/utf8"
)

// TripTransitLine is the bus, subway or train line a hop rode: an
// OpenStreetMap route relation or a Transitland route, kept with the name and
// color the map shows.
type TripTransitLine struct {
	// ID is the route relation's OpenStreetMap ID.
	ID int64 `json:"id"`
	// Name is the line's name, such as "Midosuji Line".
	Name string `json:"name"`
	// Ref is its short number or letter, such as "M"; "" when none.
	Ref string `json:"ref,omitempty"`
	// Colour is the line's color, such as "#e5171f", which the map draws it
	// in; "" for the usual hop color.
	Colour string `json:"colour,omitempty"`
	// Source is where the line was found: "" for OpenStreetMap, whose route
	// relation ID is its ID, or "transitland" for a Transitland route.
	Source string `json:"source,omitempty"`
}

// lineModes are the modes a hop can name the line it rode for.
var lineModes = map[string]bool{ModeTrain: true, ModeSubway: true, ModeBus: true, ModeTransit: true}

// colourPattern is a color as OpenStreetMap writes one: a hex code or a
// color's name.
var colourPattern = regexp.MustCompile(`^#?[0-9A-Za-z]{1,32}$`)

// trimLine drops the nth segment's line when its mode rides none, checks the
// line it keeps, and drops its path when it neither follows streets nor
// rides a line.
func trimLine(seg *TripSegment, n int) *PublishError {
	if !lineModes[seg.Mode] {
		seg.Line = nil
	}
	if seg.Line == nil {
		seg.Board, seg.Alight = nil, nil
	}
	if !streetModes[seg.Mode] && seg.Line == nil {
		seg.Path = nil
	}
	for _, p := range []*TripPoint{seg.Board, seg.Alight} {
		if perr := validTripPoint(p, n); perr != nil {
			return perr
		}
	}
	if perr := trimStationWalks(seg, n); perr != nil {
		return perr
	}
	return validLine(seg.Line, n)
}

// validLine fails when the nth segment's line, if it has one, has no name,
// too long a name or number, or a color that isn't one.
func validLine(l *TripTransitLine, n int) *PublishError {
	if l == nil {
		return nil
	}
	l.Name, l.Ref, l.Colour = strings.TrimSpace(l.Name), strings.TrimSpace(l.Ref), strings.TrimSpace(l.Colour)
	if l.Name == "" || utf8.RuneCountInString(l.Name) > maxEntryTextLength || utf8.RuneCountInString(l.Ref) > 32 {
		return publishErr(http.StatusBadRequest, "Segment %d: its line needs a name of up to %d characters and a number of up to 32.", n, maxEntryTextLength)
	}
	if l.Source != "" && l.Source != "transitland" {
		l.Source = ""
	}
	if l.Colour != "" && !colourPattern.MatchString(l.Colour) {
		return publishErr(http.StatusBadRequest, "Segment %d: its line's color should be a hex code such as #e5171f.", n)
	}
	return nil
}

// lineProps are the name, number and color the map shows for l; all ""
// for none.
func lineProps(l *TripTransitLine) (name, ref, colour string) {
	if l == nil {
		return "", "", ""
	}
	return l.Name, l.Ref, l.Colour
}

// segmentFeatures are seg of line drawn through spots: the segment itself
// and, for a hop that got on or off its line away from its photos, the walks
// between those photos and the stations. None for a wander, which draws no
// line, or when it has fewer than two points.
func segmentFeatures(line TripLine, seg TripSegment, spots map[int]tripSpot) []tripLineFeature {
	if seg.Mode == ModeWander {
		return nil
	}
	f, ok := segmentFeature(line, seg, spots)
	if !ok {
		return nil
	}
	coords, photos := segmentPoints(seg, spots)
	first, last := photos[:min(1, len(photos))], photos[max(0, len(photos)-1):]
	out := stationWalk(line, seg.Name, seg.Board, func(st [2]float64) [][2]float64 { return walkPoints(seg.BoardWalk, coords[0], st) }, first)
	out = append(out, f)
	return append(out, stationWalk(line, seg.Name, seg.Alight, func(st [2]float64) [][2]float64 { return walkPoints(seg.AlightWalk, st, coords[len(coords)-1]) }, last)...)
}

// stationWalk is the walk between a hop's photo spot and the station it got
// on or off at, drawn through the points walk gives for the station, as a
// one-feature list; none when it has no such station.
func stationWalk(line TripLine, name string, station *TripPoint, walk func([2]float64) [][2]float64, photos []int) []tripLineFeature {
	if station == nil {
		return nil
	}
	coords := walk([2]float64{station.Longitude, station.Latitude})
	props := tripLineProps{Day: line.Day, Mode: ModeWalk, Name: name, Auto: line.Auto, Photos: photos, Km: lineKm(coords)}
	return []tripLineFeature{{Type: "Feature", Geometry: tripLineGeometry{Type: "LineString", Coordinates: coords}, Properties: props}}
}

// rideEnds are coords with their first and last points moved to the
// station seg got on and off at, when it names them: the stretch its line
// rides.
func rideEnds(seg TripSegment, coords [][2]float64) [][2]float64 {
	out := slices.Clone(coords)
	if seg.Board != nil {
		out[0] = [2]float64{seg.Board.Longitude, seg.Board.Latitude}
	}
	if seg.Alight != nil {
		out[len(out)-1] = [2]float64{seg.Alight.Longitude, seg.Alight.Latitude}
	}
	return out
}
