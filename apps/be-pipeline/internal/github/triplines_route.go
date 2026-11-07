package github

import (
	"context"
	"math"
	"net/http"
	"slices"
	"time"
)

// RouteFunc finds the path along streets through points, each [longitude,
// latitude], travelled by mode ("walk", "bus" or "car").
type RouteFunc func(ctx context.Context, mode string, points [][2]float64) ([][2]float64, error)

// streetModes are the modes whose segments follow streets; a train or subway
// is drawn straight.
var streetModes = map[string]bool{ModeWalk: true, ModeBus: true, ModeCar: true}

// Limits on finding paths when a trip line is saved: all of a day's routes
// together get routeTimeout, and a path keeps up to maxPathPoints points.
const (
	routeTimeout  = 25 * time.Second
	maxPathPoints = 20000
)

// routeSegments gives each of line's walk, bus and car segments without a
// path its path along streets, found by route, and drops the path of any
// other segment. It returns how many got none: route failed, ran out of time,
// or is nil.
func routeSegments(ctx context.Context, line TripLine, spots map[int]tripSpot, route RouteFunc) int {
	ctx, cancel := context.WithTimeout(ctx, routeTimeout)
	defer cancel()
	unrouted := 0
	for i := range line.Segments {
		if !routeSegment(ctx, &line.Segments[i], spots, route) {
			unrouted++
		}
	}
	return unrouted
}

// routeSegment gives seg its path when it follows streets and has none, and
// reports false when it follows streets and is left without one.
func routeSegment(ctx context.Context, seg *TripSegment, spots map[int]tripSpot, route RouteFunc) bool {
	if !streetModes[seg.Mode] || len(seg.Path) >= 2 {
		return true
	}
	if route == nil {
		return false
	}
	points, _ := segmentPoints(*seg, spots)
	path, err := route(ctx, seg.Mode, points)
	if err != nil || len(path) < 2 || len(path) > maxPathPoints {
		return false
	}
	seg.Path = roundPath(path)
	return true
}

// segmentPoints are the spots seg's line goes through, each [longitude,
// latitude], and the IDs of its photos in spots: its start, the via spots
// after it, then each photo in spots (or the area exit or entrance standing
// in for the first or last, see areaEnd) followed by its via spots, then its
// end.
func segmentPoints(seg TripSegment, spots map[int]tripSpot) ([][2]float64, []int) {
	out := pointOf(seg.Start)
	out = append(out, viaAfter(seg.Via, nil)...)
	photos := []int{}
	for i, id := range seg.Photos {
		if s, ok := spots[id]; ok {
			out = append(out, areaEnd(seg, i, [2]float64{s.Longitude, s.Latitude}))
			photos = append(photos, id)
		}
		out = append(out, viaAfter(seg.Via, &id)...)
	}
	return append(out, pointOf(seg.End)...), photos
}

// areaEnd is the spot drawn for seg's photo at index i, whose own spot is
// at: the exit of the area the first photo is in (From) or the entrance of
// the area the last one is in (To), when set, or else at.
func areaEnd(seg TripSegment, i int, at [2]float64) [2]float64 {
	switch {
	case i == 0 && seg.From != nil:
		return [2]float64{seg.From.Longitude, seg.From.Latitude}
	case i == len(seg.Photos)-1 && seg.To != nil:
		return [2]float64{seg.To.Longitude, seg.To.Latitude}
	}
	return at
}

// pointOf is p as a one-point list, or none when p is nil.
func pointOf(p *TripPoint) [][2]float64 {
	if p == nil {
		return nil
	}
	return [][2]float64{{p.Longitude, p.Latitude}}
}

// viaAfter is the via spots after the photo after, in order; nil after the
// start spot.
func viaAfter(via []TripVia, after *int) [][2]float64 {
	var out [][2]float64
	for _, v := range via {
		if sameAfter(v.After, after) {
			out = append(out, [2]float64{v.Longitude, v.Latitude})
		}
	}
	return out
}

// sameAfter reports whether a and b name the same photo, or are both nil.
func sameAfter(a, b *int) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}

// maxVia is the most via spots a segment can have.
const maxVia = 200

// validVia fails when the nth segment has too many via spots, one off the
// globe, one after a photo not in it, or one after its start with no start.
func validVia(seg TripSegment, n int) *PublishError {
	if len(seg.Via) > maxVia {
		return publishErr(http.StatusBadRequest, "Segment %d: keep it to %d via spots.", n, maxVia)
	}
	for _, v := range seg.Via {
		if perr := validTripPoint(&TripPoint{Latitude: v.Latitude, Longitude: v.Longitude}, n); perr != nil {
			return perr
		}
		if !viaAnchored(seg, v.After) {
			return publishErr(http.StatusBadRequest, "Segment %d: a via spot comes after a photo or start spot it doesn't have.", n)
		}
	}
	return nil
}

// viaAnchored reports whether seg has what a via spot after after comes
// after: that photo, or a start spot for nil.
func viaAnchored(seg TripSegment, after *int) bool {
	if after == nil {
		return seg.Start != nil
	}
	return slices.Contains(seg.Photos, *after)
}

// roundPath is path with each coordinate rounded to 6 decimal places, about
// 10 cm, so the files stay small.
func roundPath(path [][2]float64) [][2]float64 {
	out := make([][2]float64, len(path))
	for i, p := range path {
		out[i] = [2]float64{math.Round(p[0]*1e6) / 1e6, math.Round(p[1]*1e6) / 1e6}
	}
	return out
}

// validPath fails when the nth segment's path, if it has one, is too long or
// has a point off the globe.
func validPath(path [][2]float64, n int) *PublishError {
	if len(path) > maxPathPoints {
		return publishErr(http.StatusBadRequest, "Segment %d: its path has more than %d points.", n, maxPathPoints)
	}
	for _, p := range path {
		if p[0] < -180 || p[0] > 180 || p[1] < -90 || p[1] > 90 {
			return publishErr(http.StatusBadRequest, "Segment %d: its path has a point off the map.", n)
		}
	}
	return nil
}

// pathFitKm is how far a path's ends may be from its segment's first and last
// points and still be drawn; further, a photo's spot changed since the path
// was found, and the segment is drawn straight until it's saved again.
const pathFitKm = 0.3

// pathFits reports whether path starts and ends near coords' first and last
// points.
func pathFits(path, coords [][2]float64) bool {
	if len(path) < 2 || len(coords) < 2 {
		return false
	}
	return near(path[0], coords[0]) && near(path[len(path)-1], coords[len(coords)-1])
}

// near reports whether a and b, each [longitude, latitude], are within
// pathFitKm.
func near(a, b [2]float64) bool {
	return distanceKm(a[1], a[0], b[1], b[0]) <= pathFitKm
}
