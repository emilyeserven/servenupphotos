package github

import "slices"

// autoLineSegments is the automatic line of line's day through spots, passing
// through each of its trip stops placed after a photo it walks on from.
func autoLineSegments(spots map[int]tripSpot, line TripLine) []TripSegment {
	return withStopVias(autoSegments(spotsOn(spots, line.Day)), line.Visits)
}

// withStopVias is segments with a via spot for each trip stop in visits that
// comes after a photo a walk goes on from, so the line passes through it on
// the way to the next photo, the way a line drawn by hand does. A stop after
// a walk's last photo, or on a hop or drive, stays a pin.
func withStopVias(segments []TripSegment, visits []TripVisit) []TripSegment {
	for i, v := range visits {
		if v.After == nil {
			continue
		}
		for s := range segments {
			if walksOnFrom(segments[s], *v.After) {
				n := i
				segments[s].Via = append(segments[s].Via, TripVia{After: v.After, Latitude: v.Latitude, Longitude: v.Longitude, Visit: &n})
			}
		}
	}
	return segments
}

// walksOnFrom reports whether seg is a walk that goes on from photo id to
// another photo.
func walksOnFrom(seg TripSegment, id int) bool {
	at := slices.Index(seg.Photos, id)
	return seg.Mode == ModeWalk && at >= 0 && at < len(seg.Photos)-1
}
