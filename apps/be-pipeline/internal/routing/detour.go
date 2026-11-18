package routing

import (
	"context"
	"math"
)

// Some roads are mapped in OpenStreetMap as closed to people on foot, such as
// a national route with no pavement mapped, or one whose pavements are mapped
// as separate paths not joined to it. The foot profile won't walk along them,
// so a via spot on one is reached by the nearest side street, there and back.
// Each stretch of a walk (from one spot to the next) that detours like that is
// asked for by road too, and the road's stretch is drawn when it's clearly
// shorter. Stretches that don't detour, such as through a shrine's grounds
// where no car goes, keep the foot path.

// detourRatio is how much longer than the straight line between its two spots
// a stretch is before the road is tried for it. Streets usually add a fifth
// to a third.
const detourRatio = 1.6

// minDetourKm is how much longer than the straight line a stretch must be
// before the road is tried for it, so a short stretch round a corner isn't.
const minDetourKm = 0.15

// byRoadGain is how much shorter the road's stretch must be to be drawn.
const byRoadGain = 0.85

// roadWhereShorter is walked's path with each stretch that detours (see
// detourRatio) replaced by p's, when that's clearly shorter. It asks the
// server once more, only when some stretch detours, and keeps walked's path
// when that request fails or its stretches don't line up.
func (c *Client) roadWhereShorter(ctx context.Context, p profile, walked route, points [][2]float64) [][2]float64 {
	detours := detouredLegs(walked.legs, points)
	if len(detours) == 0 {
		return walked.path
	}
	road, err := c.ask(ctx, p, points)
	if err != nil || len(road.legs) != len(walked.legs) {
		return walked.path
	}
	legs := walked.legs
	changed := false
	for _, i := range detours {
		if len(road.legs[i]) >= 2 && lengthKm(road.legs[i]) <= byRoadGain*lengthKm(legs[i]) {
			legs[i] = road.legs[i]
			changed = true
		}
	}
	if !changed {
		return walked.path
	}
	var out [][2]float64
	for _, leg := range legs {
		out = joined(out, leg)
	}
	return out
}

// detouredLegs are the indexes of the legs, each the stretch from points[i]
// to points[i+1], that detour; none when the legs don't match the points.
func detouredLegs(legs [][][2]float64, points [][2]float64) []int {
	if len(legs) != len(points)-1 {
		return nil
	}
	var out []int
	for i, leg := range legs {
		if len(leg) < 2 {
			return nil
		}
		straight := distanceKm(points[i], points[i+1])
		walked := lengthKm(leg)
		if walked > detourRatio*straight && walked-straight > minDetourKm {
			out = append(out, i)
		}
	}
	return out
}

// joined is line with more after it, leaving out more's first point when
// it's where line ends.
func joined(line, more [][2]float64) [][2]float64 {
	if len(line) > 0 && len(more) > 0 && line[len(line)-1] == more[0] {
		more = more[1:]
	}
	return append(line, more...)
}

// lengthKm is how long the line through points, each [longitude, latitude],
// is, in kilometres.
func lengthKm(points [][2]float64) float64 {
	total := 0.0
	for i := 1; i < len(points); i++ {
		total += distanceKm(points[i-1], points[i])
	}
	return total
}

// distanceKm is the great-circle distance between a and b, each [longitude,
// latitude], in kilometres.
func distanceKm(a, b [2]float64) float64 {
	const earthKm = 6371.0
	rad := math.Pi / 180
	dLat := (b[1] - a[1]) * rad
	dLng := (b[0] - a[0]) * rad
	h := math.Sin(dLat/2)*math.Sin(dLat/2) + math.Cos(a[1]*rad)*math.Cos(b[1]*rad)*math.Sin(dLng/2)*math.Sin(dLng/2)
	return 2 * earthKm * math.Asin(math.Sqrt(h))
}
