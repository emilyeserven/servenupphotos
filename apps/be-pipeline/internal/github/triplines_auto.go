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
	b := autoLine{segments: []TripSegment{}}
	var prev *tripSpot
	for _, s := range spots {
		b.add(prev, s)
		prev = &s
	}
	b.flush()
	return b.segments
}

// autoLine builds the automatic line one photo at a time: the segments so
// far, and the walk being added to.
type autoLine struct {
	segments []TripSegment
	walk     []int
}

// add adds s, taken after prev (nil for the day's first photo), by the gap
// between them.
func (b *autoLine) add(prev *tripSpot, s tripSpot) {
	if prev == nil {
		b.walk = []int{s.ID}
		return
	}
	gap := gapBetween(*prev, s)
	if gap == gapWalk {
		b.walk = append(b.walk, s.ID)
		return
	}
	b.flush()
	if gap == gapHop {
		b.segments = append(b.segments, TripSegment{Mode: ModeTransit, Photos: []int{prev.ID, s.ID}})
	}
	b.walk = []int{s.ID}
}

// flush ends the walk being added to, keeping it when it has two or more photos.
func (b *autoLine) flush() {
	if len(b.walk) >= 2 {
		b.segments = append(b.segments, TripSegment{Mode: ModeWalk, Photos: b.walk})
	}
	b.walk = nil
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
