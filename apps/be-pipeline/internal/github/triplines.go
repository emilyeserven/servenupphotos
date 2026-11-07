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
	// ModeWander is wandering around one area with no set route, such as a
	// hike: no line is drawn through its photos; the lines before and after
	// it run to the area's entrance and from its exit (TripSegment.To and
	// From) when those are set.
	ModeWander = "wander"
)

// tripModes are the modes a segment can have.
var tripModes = []string{ModeWalk, ModeTrain, ModeSubway, ModeBus, ModeCar, ModeTransit, ModeWander}

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
	// Name names the line the segment is part of, such as "Nara Park": the
	// segments between two breaks make one line, and share it. "" for none.
	Name string `json:"name,omitempty"`
	// Start is a spot with no photo the line starts from, before Photos.
	Start *TripPoint `json:"start,omitempty"`
	// Photos are the IDs of the day's photos the line goes through, in
	// order. A photo can end one segment and start the next.
	Photos []int `json:"photos"`
	// End is a spot with no photo the line ends at, after Photos.
	End *TripPoint `json:"end,omitempty"`
	// From is where the line leaves the area its first photo was taken in,
	// such as a park's gate after wandering it (ModeWander): drawn instead of
	// that photo's spot. Nil draws the photo's spot.
	From *TripPoint `json:"from,omitempty"`
	// To is where the line enters the area its last photo was taken in,
	// drawn instead of that photo's spot. Nil draws the photo's spot.
	To *TripPoint `json:"to,omitempty"`
	// Via are spots the line goes through between its photos, to shape it.
	Via []TripVia `json:"via,omitempty"`
	// Path is the line along streets through the segment's points, each
	// [longitude, latitude], found by Snap to streets (see RouteTripLine), or
	// a hop's track along its Line; none before either, which draws it
	// straight through the points.
	Path [][2]float64 `json:"path,omitempty"`
	// Line is the bus, subway or train line a hop rode, picked from the ones
	// OpenStreetMap maps; nil when not picked.
	Line *TripTransitLine `json:"line,omitempty"`
	// Board and Alight are the station or stop a hop with a Line got on and
	// off at, when away from its photos, such as a station a 10-minute walk
	// from the next photo: the line rides between them, with a walk from
	// the first photo and to the last one. Nil rides from or to the photo.
	Board  *TripPoint `json:"board,omitempty"`
	Alight *TripPoint `json:"alight,omitempty"`
}

// TripVia is a spot a segment's line goes through to shape it, such as a
// bridge crossed between two photos.
type TripVia struct {
	// After is the ID of the photo the spot comes after; nil puts it right
	// after the segment's start spot. Spots with the same After keep their
	// order.
	After     *int    `json:"after,omitempty"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	// Visit is the place visited (its index in the day's visits) this spot
	// stands for, so the line passes through it; nil for a spot of its own.
	Visit *int `json:"visit,omitempty"`
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
	// Visits are the places visited along the day's route, such as a
	// restaurant, with or without a photo; none when there are none.
	Visits []TripVisit `json:"visits,omitempty"`
	// Fences are the areas photos without an exact spot were taken in, such
	// as a park; none when there are none.
	Fences []TripFence `json:"fences,omitempty"`
	// Order is the day's photo IDs in the order they were moved into by hand,
	// such as when a camera's clock was off; none while they're in the order
	// they were taken. The editor reads the segments in this order.
	Order []int `json:"order,omitempty"`
}

// SaveTripLine saves line as <folder>/triplines/<day>.json, new or replacing
// the one there, in the pending changes, with the paths along streets it was
// given (see RouteTripLine). It fails when a photo isn't from that day or has
// no exact spot.
func (c *Client) SaveTripLine(ctx context.Context, gh settings.GitHub, line TripLine) (EntryResult, error) {
	line, _, perr := c.checkedTripLine(ctx, gh, line)
	if perr != nil {
		return EntryResult{}, perr
	}
	return c.saveEntry(ctx, gh, TripLines, line.ID, line, func([]Entry) *PublishError { return nil })
}

// RoutedTripLine is a trip line with its walks, bus rides and drives snapped
// to streets, and how many of those got no route, so they stay straight.
type RoutedTripLine struct {
	Line     TripLine `json:"line"`
	Unrouted int      `json:"unrouted"`
}

// RouteTripLine is line, not saved, with the path along streets of each walk,
// bus or car segment that hasn't one yet found by route through its photos
// and via spots, for the pipeline to show before it's saved.
func (c *Client) RouteTripLine(ctx context.Context, gh settings.GitHub, line TripLine, route RouteFunc) (RoutedTripLine, error) {
	line, spots, perr := c.checkedTripLine(ctx, gh, line)
	if perr != nil {
		return RoutedTripLine{}, perr
	}
	unrouted := routeSegments(ctx, line, spots, route)
	return RoutedTripLine{Line: line, Unrouted: unrouted}, nil
}

// checkedTripLine is line trimmed as it will be saved, and the photos a line
// can go through, by ID. It fails when line isn't valid, or a photo isn't
// from its day or has no exact spot.
func (c *Client) checkedTripLine(ctx context.Context, gh settings.GitHub, line TripLine) (TripLine, map[int]tripSpot, *PublishError) {
	line, perr := validTripLine(line)
	if perr != nil {
		return line, nil, perr
	}
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return line, nil, perr
	}
	spots := w.tripSpots(false)
	if perr := checkTripPhotos(line, spots); perr != nil {
		return line, spots, perr
	}
	return line, spots, checkFencePhotos(line, w.photoDays())
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
	if perr := validVisits(line.Visits, line.Segments); perr != nil {
		return line, perr
	}
	return line, validFences(line.Fences)
}

// validTripSegment checks the nth segment and returns it trimmed.
func validTripSegment(seg TripSegment, n int) (TripSegment, *PublishError) {
	if !slices.Contains(tripModes, seg.Mode) {
		return seg, publishErr(http.StatusBadRequest, "Segment %d: pick how it was travelled (%s).", n, strings.Join(tripModes, ", "))
	}
	if seg.Photos == nil {
		seg.Photos = []int{}
	}
	seg.Name = strings.TrimSpace(seg.Name)
	if utf8.RuneCountInString(seg.Name) > maxEntryTextLength {
		return seg, publishErr(http.StatusBadRequest, "Segment %d: keep its line's name to %d characters.", n, maxEntryTextLength)
	}
	if pointCount(seg) < 2 {
		return seg, publishErr(http.StatusBadRequest, "Segment %d needs at least two points to draw a line.", n)
	}
	for _, p := range []*TripPoint{seg.Start, seg.End, seg.From, seg.To} {
		if perr := validTripPoint(p, n); perr != nil {
			return seg, perr
		}
	}
	if perr := validPath(seg.Path, n); perr != nil {
		return seg, perr
	}
	if perr := validVia(seg, n); perr != nil {
		return seg, perr
	}
	if perr := trimLine(&seg, n); perr != nil {
		return seg, perr
	}
	return seg, repeatedPhoto(seg, n)
}

// pointCount is how many points seg's line goes through.
func pointCount(seg TripSegment) int {
	n := len(seg.Photos) + len(seg.Via)
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
