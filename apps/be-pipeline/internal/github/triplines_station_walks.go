package github

import (
	"context"
	"net/http"
)

// StationWalk shapes the walk between a hop's photo and the station it got
// on or off at, such as from a bus stop around a park to the next photo.
type StationWalk struct {
	// Via are the spots the walk goes through, in order from the photo to
	// the station when getting on, and from the station to the photo when
	// getting off.
	Via []TripPoint `json:"via,omitempty"`
	// Path is the walk along streets, each [longitude, latitude], found by
	// Snap to streets; none draws it straight through its spots.
	Path [][2]float64 `json:"path,omitempty"`
}

// trimStationWalks drops the walks of a hop's ends with no station, and
// checks and rounds the ones it keeps.
func trimStationWalks(seg *TripSegment, n int) *PublishError {
	if seg.Board == nil {
		seg.BoardWalk = nil
	}
	if seg.Alight == nil {
		seg.AlightWalk = nil
	}
	for _, w := range []*StationWalk{seg.BoardWalk, seg.AlightWalk} {
		if perr := validStationWalk(w, n); perr != nil {
			return perr
		}
	}
	return nil
}

// validStationWalk checks the nth segment's walk to or from a station, if it
// has one, rounding its path.
func validStationWalk(w *StationWalk, n int) *PublishError {
	if w == nil {
		return nil
	}
	if len(w.Via) > maxVia {
		return publishErr(http.StatusBadRequest, "Segment %d: keep a walk to a station to %d via spots.", n, maxVia)
	}
	for i := range w.Via {
		if perr := validTripPoint(&w.Via[i], n); perr != nil {
			return perr
		}
	}
	w.Path = roundPath(w.Path)
	return validPath(w.Path, n)
}

// walkPoints are the points a walk from from to to goes through, by way of
// its via spots: its path when it has one that still starts and ends there,
// or else straight through them.
func walkPoints(w *StationWalk, from, to [2]float64) [][2]float64 {
	points := [][2]float64{from}
	if w != nil {
		for _, v := range w.Via {
			points = append(points, [2]float64{v.Longitude, v.Latitude})
		}
	}
	points = append(points, to)
	if w != nil && pathFits(w.Path, points) {
		return w.Path
	}
	return points
}

// routeStationWalks gives the walks to and from seg's stations a path along
// streets when they have none, and reports how many were left without one.
func routeStationWalks(ctx context.Context, seg *TripSegment, spots map[int]tripSpot, route RouteFunc) int {
	coords, _ := segmentPoints(*seg, spots)
	if len(coords) < 2 {
		return 0
	}
	unrouted := 0
	if seg.Board != nil {
		seg.BoardWalk, unrouted = routedWalk(ctx, seg.BoardWalk, coords[0], pointCoords(seg.Board), route, unrouted)
	}
	if seg.Alight != nil {
		seg.AlightWalk, unrouted = routedWalk(ctx, seg.AlightWalk, pointCoords(seg.Alight), coords[len(coords)-1], route, unrouted)
	}
	return unrouted
}

// routedWalk is w with a path along streets from from to to, when it has
// none yet, and unrouted plus one when none was found.
func routedWalk(ctx context.Context, w *StationWalk, from, to [2]float64, route RouteFunc, unrouted int) (*StationWalk, int) {
	if w == nil {
		w = &StationWalk{}
	}
	if len(w.Path) >= 2 {
		return w, unrouted
	}
	points := walkPoints(&StationWalk{Via: w.Via}, from, to)
	if route == nil {
		return w, unrouted + 1
	}
	path, err := route(ctx, ModeWalk, points)
	if err != nil || len(path) < 2 || len(path) > maxPathPoints {
		return w, unrouted + 1
	}
	w.Path = roundPath(path)
	return w, unrouted
}
