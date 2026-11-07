package github

import (
	"context"
	"net/http"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// The ways a trip line segment can be travelled. A walk is drawn through every
// photo in it; the others are drawn as a straight dashed line from the first
// point to the last, since the real track isn't known. ModeTransit is a hop
// whose kind isn't known, as the automatic line marks one.
const (
	ModeWalk    = "walk"
	ModeTrain   = "train"
	ModeSubway  = "subway"
	ModeBus     = "bus"
	ModeCar     = "car"
	ModeTransit = "transit"
)

// tripModes are the modes a segment can have.
var tripModes = []string{ModeWalk, ModeTrain, ModeSubway, ModeBus, ModeCar, ModeTransit}

// TripPoint is a spot on a trip line with no photo, such as the hotel a day
// starts from.
type TripPoint struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	// Label names the spot, such as "Hotel"; "" for none.
	Label string `json:"label,omitempty"`
}

// TripSegment is one stretch of a day's trip line, travelled one way.
type TripSegment struct {
	// Mode is how the stretch was travelled: one of tripModes.
	Mode string `json:"mode"`
	// Start is a spot with no photo the line starts from, before Photos.
	Start *TripPoint `json:"start,omitempty"`
	// Photos are the IDs of the day's photos the line goes through, in
	// order. A photo can end one segment and start the next.
	Photos []int `json:"photos"`
	// End is a spot with no photo the line ends at, after Photos.
	End *TripPoint `json:"end,omitempty"`
}

// TripLine is a trip line file: the route of one day, which the portfolio's
// map draws.
type TripLine struct {
	// ID is the day, such as "2026-09-23".
	ID string `json:"id"`
	// Day is the day the photos were taken, the same as ID.
	Day string `json:"day"`
	// Auto is true for the automatic line, worked out again from the day's
	// photos at every Commit (see autoSegments); Segments is then empty.
	Auto bool `json:"auto"`
	// Segments are the stretches of the day, in the order they happened.
	Segments []TripSegment `json:"segments"`
}

// SaveTripLine saves line as <folder>/triplines/<day>.json, new or replacing
// the one there, in the pending changes. It fails when a photo isn't from that
// day or has no exact spot.
func (c *Client) SaveTripLine(ctx context.Context, gh settings.GitHub, line TripLine) (EntryResult, error) {
	line, perr := validTripLine(line)
	if perr != nil {
		return EntryResult{}, perr
	}
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return EntryResult{}, perr
	}
	if perr := checkTripPhotos(line, w.tripSpots(false)); perr != nil {
		return EntryResult{}, perr
	}
	return c.saveEntry(ctx, gh, TripLines, line.ID, line, func([]Entry) *PublishError { return nil })
}

// DeleteTripLine removes the trip line file of day in the pending changes.
func (c *Client) DeleteTripLine(ctx context.Context, gh settings.GitHub, day string) (EntryResult, error) {
	return c.deleteEntry(ctx, gh, TripLines, day, func([]Entry) *PublishError { return nil })
}

// AutoTripLine is the automatic line of day, as the next Commit would draw it
// from the photos then: for the pipeline to preview before it's turned on, or
// to copy and change by hand.
func (c *Client) AutoTripLine(ctx context.Context, gh settings.GitHub, day string) (TripLine, error) {
	if _, err := time.Parse(labelDateLayout, day); err != nil {
		return TripLine{}, publishErr(http.StatusBadRequest, "Give the day as a date, such as 2026-09-23.")
	}
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return TripLine{}, perr
	}
	return TripLine{ID: day, Day: day, Segments: autoSegments(spotsOn(w.tripSpots(false), day))}, nil
}

// validTripLine checks line and returns it trimmed, as it will be saved.
func validTripLine(line TripLine) (TripLine, *PublishError) {
	line.ID = strings.TrimSpace(line.ID)
	line.Day = line.ID
	if _, err := time.Parse(labelDateLayout, line.ID); err != nil {
		return line, publishErr(http.StatusBadRequest, "Give the day as a date, such as 2026-09-23.")
	}
	if line.Auto || line.Segments == nil {
		line.Segments = []TripSegment{}
	}
	for i := range line.Segments {
		seg, perr := validTripSegment(line.Segments[i], i+1)
		if perr != nil {
			return line, perr
		}
		line.Segments[i] = seg
	}
	return line, nil
}

// validTripSegment checks the nth segment and returns it trimmed.
func validTripSegment(seg TripSegment, n int) (TripSegment, *PublishError) {
	if !slices.Contains(tripModes, seg.Mode) {
		return seg, publishErr(http.StatusBadRequest, "Segment %d: pick how it was travelled (%s).", n, strings.Join(tripModes, ", "))
	}
	if seg.Photos == nil {
		seg.Photos = []int{}
	}
	if pointCount(seg) < 2 {
		return seg, publishErr(http.StatusBadRequest, "Segment %d needs at least two points to draw a line.", n)
	}
	for _, p := range []*TripPoint{seg.Start, seg.End} {
		if perr := validTripPoint(p, n); perr != nil {
			return seg, perr
		}
	}
	return seg, repeatedPhoto(seg, n)
}

// pointCount is how many points seg's line goes through.
func pointCount(seg TripSegment) int {
	n := len(seg.Photos)
	if seg.Start != nil {
		n++
	}
	if seg.End != nil {
		n++
	}
	return n
}

// validTripPoint fails when p, if set, isn't a GPS position or its label is
// too long, and trims its label.
func validTripPoint(p *TripPoint, n int) *PublishError {
	if p == nil {
		return nil
	}
	p.Label = strings.TrimSpace(p.Label)
	if p.Latitude < -90 || p.Latitude > 90 || p.Longitude < -180 || p.Longitude > 180 {
		return publishErr(http.StatusBadRequest, "Segment %d: a spot's latitude must be from -90 to 90 and its longitude from -180 to 180.", n)
	}
	if utf8.RuneCountInString(p.Label) > maxEntryTextLength {
		return publishErr(http.StatusBadRequest, "Segment %d: keep a spot's label to %d characters.", n, maxEntryTextLength)
	}
	return nil
}

// repeatedPhoto fails when a photo is in seg more than once.
func repeatedPhoto(seg TripSegment, n int) *PublishError {
	seen := map[int]bool{}
	for _, id := range seg.Photos {
		if seen[id] {
			return publishErr(http.StatusBadRequest, "Segment %d goes through photo %d twice.", n, id)
		}
		seen[id] = true
	}
	return nil
}

// checkTripPhotos fails when one of line's photos isn't in spots, or isn't
// from line's day.
func checkTripPhotos(line TripLine, spots map[int]tripSpot) *PublishError {
	for i, seg := range line.Segments {
		for _, id := range seg.Photos {
			spot, ok := spots[id]
			if !ok {
				return publishErr(http.StatusBadRequest, "Segment %d: photo %d has no exact spot (its own GPS position, or a place marked as an exact location), so a line can't go through it.", i+1, id)
			}
			if spot.Day != line.Day {
				return publishErr(http.StatusBadRequest, "Segment %d: photo %d was taken on %s, not %s.", i+1, id, spot.Day, line.Day)
			}
		}
	}
	return nil
}
