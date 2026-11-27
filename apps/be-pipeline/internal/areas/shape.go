// Package areas is the outline of an area, such as a park, a neighbourhood
// or a city, as the trip lines' and places' areas save it. The area search
// that finds them on OpenStreetMap is in the BFF (apps/bff-pipeline,
// docs/bff-routes.md); this is what a save checks.
package areas

// MaxPoints is the most points a saved outline may have, the same limit the
// area search keeps its answers to.
const MaxPoints = 5000

// Shape is a GeoJSON MultiPolygon's coordinates: polygons, each an outer ring
// then any holes, each ring [longitude, latitude] points ending where it
// starts.
type Shape [][][][2]float64

// Points is how many points shape has.
func Points(shape Shape) int {
	n := 0
	for _, polygon := range shape {
		for _, ring := range polygon {
			n += len(ring)
		}
	}
	return n
}
