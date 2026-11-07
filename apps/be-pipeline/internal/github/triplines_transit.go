package github

import (
	"net/http"
	"regexp"
	"strings"
	"unicode/utf8"
)

// TripTransitLine is the bus, subway or train line a hop rode: an
// OpenStreetMap route relation, kept with the name and color the map shows.
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
	if !streetModes[seg.Mode] && seg.Line == nil {
		seg.Path = nil
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
