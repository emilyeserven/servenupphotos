package github

import "math"

// arcPoints is how many points a flight's arc is drawn with.
const arcPoints = 24

// arcBend is how far a flight's arc bows out from the straight line, as a
// share of its length.
const arcBend = 0.15

// bakeTrips is the Trips' legs as GeoJSON lines, each from where it left to
// where it arrived through spots: flights as a gentle arc, the others
// straight. A leg whose day has no photo with a spot, and no spot of its
// own, isn't drawn.
func bakeTrips(trips []Trip, spots map[int]tripSpot) []any {
	out := []any{}
	for _, trip := range trips {
		for _, leg := range trip.Legs {
			if f, ok := legFeature(trip, leg, spots); ok {
				out = append(out, f)
			}
		}
	}
	return out
}

// legEnd is where a leg's end is, as [longitude, latitude], its label, and
// the photo it's at (0 for a spot with no photo). Without a photo of its
// own, last picks the day's last photo rather than its first. False when the
// day has no photo to use.
func legEnd(end TripLegEnd, spots map[int]tripSpot, last bool) ([2]float64, string, int, bool) {
	if end.Spot != nil {
		return [2]float64{end.Spot.Longitude, end.Spot.Latitude}, end.Spot.Label, 0, true
	}
	s, ok := legPhoto(end, spots, last)
	return [2]float64{s.Longitude, s.Latitude}, "", s.ID, ok
}

// legPhoto is the photo a leg's end uses: the one it names when that photo
// has a spot on its day, or else the day's last or first. False when the day
// has none.
func legPhoto(end TripLegEnd, spots map[int]tripSpot, last bool) (tripSpot, bool) {
	if s, ok := spots[end.Photo]; ok && end.Photo != 0 && s.Day == end.Day {
		return s, true
	}
	day := spotsOn(spots, end.Day)
	if len(day) == 0 {
		return tripSpot{}, false
	}
	if last {
		return day[len(day)-1], true
	}
	return day[0], true
}

// legFeature is leg of trip as a GeoJSON line, and false when either end has
// nothing to draw from.
func legFeature(trip Trip, leg TripLeg, spots map[int]tripSpot) (tripLineFeature, bool) {
	from, fromLabel, fromPhoto, ok1 := legEnd(leg.From, spots, true)
	to, toLabel, toPhoto, ok2 := legEnd(leg.To, spots, false)
	if !ok1 || !ok2 {
		return tripLineFeature{}, false
	}
	to = nearSide(from, to)
	coords := [][2]float64{from, to}
	if leg.Mode == ModeFlight {
		coords = arc(from, to)
	}
	props := tripLineProps{
		Day: leg.From.Day, Arrive: leg.To.Day, Trip: trip.ID, Mode: leg.Mode,
		Photos: legPhotos(fromPhoto, toPhoto), Km: lineKm([][2]float64{from, to}),
		Start: fromLabel, End: toLabel,
	}
	return tripLineFeature{Type: "Feature", Geometry: tripLineGeometry{Type: "LineString", Coordinates: coords}, Properties: props}, true
}

// legPhotos are the photos a leg leaves from and arrives at, leaving out a
// spot with no photo.
func legPhotos(ids ...int) []int {
	out := []int{}
	for _, id := range ids {
		if id != 0 {
			out = append(out, id)
		}
	}
	return out
}

// nearSide is to moved a whole turn east or west when that's the shorter
// way from from, so a flight across the Pacific isn't drawn around the
// world the other way. The map draws longitudes past 180 across the
// date line.
func nearSide(from, to [2]float64) [2]float64 {
	switch {
	case to[0]-from[0] > 180:
		to[0] -= 360
	case from[0]-to[0] > 180:
		to[0] += 360
	}
	return to
}

// arc is a gentle curve from from to to, bowed out toward the nearer pole,
// like a flight path drawn on a map: a quadratic Bézier curve through a point
// off the middle.
func arc(from, to [2]float64) [][2]float64 {
	dx, dy := to[0]-from[0], to[1]-from[1]
	bend := poleward(from, to, dx) * arcBend
	mid := [2]float64{from[0] + dx/2 - dy*bend, from[1] + dy/2 + dx*bend}
	out := make([][2]float64, 0, arcPoints+1)
	for i := 0; i <= arcPoints; i++ {
		t := float64(i) / arcPoints
		a, b, c := (1-t)*(1-t), 2*(1-t)*t, t*t
		out = append(out, [2]float64{
			round5(a*from[0] + b*mid[0] + c*to[0]),
			round5(a*from[1] + b*mid[1] + c*to[1]),
		})
	}
	return out
}

// poleward is 1 or -1, whichever bows the arc from from to to toward the
// pole of the hemisphere its middle is in, the way a great circle bows on a
// flat map.
func poleward(from, to [2]float64, dx float64) float64 {
	north := from[1]+to[1] >= 0
	if (dx >= 0) == north {
		return 1
	}
	return -1
}

// round5 is n to 5 decimals, about a meter, to keep the file small.
func round5(n float64) float64 {
	return math.Round(n*1e5) / 1e5
}
