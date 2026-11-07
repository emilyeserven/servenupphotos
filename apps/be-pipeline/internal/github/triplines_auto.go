package github

import "time"

// What the automatic line takes as a break or a hop: photos further apart in
// time than autoBreak aren't joined, and two photos further apart than
// autoMinHopKm with more than autoWalkKmh between them are a hop, not a walk.
const (
	autoBreak    = 2 * time.Hour
	autoWalkKmh  = 6.0
	autoMinHopKm = 0.3
)

// gapKind is how the automatic line joins two photos taken one after the other.
type gapKind int

const (
	gapWalk gapKind = iota
	gapHop
	gapBreak
)

// autoSegments is the automatic line through spots, taken one after the other
// on one day: walks through the photos, split where they're more than
// autoBreak apart, with a ModeTransit hop where moving between two was faster
// than walking.
func autoSegments(spots []tripSpot) []TripSegment {
	segments := []TripSegment{}
	var walk []int
	flush := func() {
		if len(walk) >= 2 {
			segments = append(segments, TripSegment{Mode: ModeWalk, Photos: walk})
		}
		walk = nil
	}
	for i, s := range spots {
		if i == 0 {
			walk = []int{s.ID}
			continue
		}
		switch gapBetween(spots[i-1], s) {
		case gapWalk:
			walk = append(walk, s.ID)
		case gapHop:
			flush()
			segments = append(segments, TripSegment{Mode: ModeTransit, Photos: []int{spots[i-1].ID, s.ID}})
			walk = []int{s.ID}
		case gapBreak:
			flush()
			walk = []int{s.ID}
		}
	}
	flush()
	return segments
}

// gapBetween is how the automatic line joins a and b, b taken after a.
func gapBetween(a, b tripSpot) gapKind {
	elapsed := b.Taken.Sub(a.Taken)
	if elapsed > autoBreak {
		return gapBreak
	}
	km := distanceKm(a.Latitude, a.Longitude, b.Latitude, b.Longitude)
	if km > autoMinHopKm && (elapsed <= 0 || km/elapsed.Hours() > autoWalkKmh) {
		return gapHop
	}
	return gapWalk
}
