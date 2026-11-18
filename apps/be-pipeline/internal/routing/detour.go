package routing

import (
	"context"
	"math"
)

// Some roads are mapped in OpenStreetMap as closed to people on foot, such as
// a national route with no pavement mapped, or one whose pavements are mapped
// as separate paths not joined to it. The foot profile won't walk along them,
// so a via spot on one is reached by the nearest side street, there and back,
// at each via spot. When a walk's path is that much longer than the straight
// line through its spots, the road path is asked for too, and the shorter
// one is drawn.

// detourRatio is how much longer than the straight line through its spots a
// walk's path is before the road path is asked for as well. Streets usually
// add a fifth to a third.
const detourRatio = 1.6

// byRoadGain is how much shorter the road path must be to be drawn instead.
const byRoadGain = 0.85

// detoured reports whether path is more than detourRatio times as long as the
// straight line through points.
func detoured(path, points [][2]float64) bool {
	straight := lengthKm(points)
	return straight > 0 && lengthKm(path) > detourRatio*straight
}

// shorterByRoad is the path through points along roads, from p, when it's
// clearly shorter than walked, or else walked, as when the server can't be
// asked.
func (c *Client) shorterByRoad(ctx context.Context, p profile, walked, points [][2]float64) [][2]float64 {
	road, err := c.ask(ctx, p, points)
	if err != nil || lengthKm(road) > byRoadGain*lengthKm(walked) {
		return walked
	}
	return road
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
