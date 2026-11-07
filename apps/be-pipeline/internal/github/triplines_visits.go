package github

import (
	"net/http"
	"net/url"
	"slices"
	"strings"
	"unicode/utf8"
)

// TripVisit is a place visited along a day's route, such as a restaurant or a
// museum, shown as a pin on the map whether or not a photo was taken there.
type TripVisit struct {
	// Name is what the place is called, such as "Ichiran Dotonbori".
	Name string `json:"name"`
	// Kind is what sort of place it is: one of visitKinds.
	Kind      string  `json:"kind"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	// Note is a few words about it, such as "Best ramen of the trip"; "" for none.
	Note string `json:"note,omitempty"`
	// Link is the place on an outside map, such as Google Maps or Naver Map;
	// "" for none.
	Link string `json:"link,omitempty"`
	// Place is the ID of the saved place it is, when picked from them; "" for
	// one dropped on the map.
	Place string `json:"place,omitempty"`
	// After is the ID of the photo the place comes after on the route, so the
	// line passes through it on the way to the next photo; nil leaves it off
	// the route, as a pin only.
	After *int `json:"after,omitempty"`
}

// visitKinds are the sorts of place a visit can be.
var visitKinds = []string{"restaurant", "cafe", "bar", "shop", "museum", "sight", "other"}

// Limits on a day's visits: how many, and how long a note or link can be.
const (
	maxVisits     = 100
	maxNoteLength = 500
	maxLinkLength = 2000
)

// validVisits checks each visit and trims its text in place.
func validVisits(visits []TripVisit, segments []TripSegment) *PublishError {
	if len(visits) > maxVisits {
		return publishErr(http.StatusBadRequest, "Keep a day to %d places visited.", maxVisits)
	}
	for i := range visits {
		if perr := validVisit(&visits[i], i+1); perr != nil {
			return perr
		}
		if !visitPlaced(visits[i].After, segments) {
			return publishErr(http.StatusBadRequest, "Place visited %d comes after a photo that isn't on the line.", i+1)
		}
	}
	return validViaVisits(segments, len(visits))
}

// visitPlaced reports whether a visit after after has that photo on the line,
// or isn't on the route (nil).
func visitPlaced(after *int, segments []TripSegment) bool {
	if after == nil {
		return true
	}
	return slices.ContainsFunc(segments, func(s TripSegment) bool { return slices.Contains(s.Photos, *after) })
}

// validViaVisits fails when a via spot stands for a place visited the day
// doesn't have (one of n).
func validViaVisits(segments []TripSegment, n int) *PublishError {
	for i, seg := range segments {
		for _, v := range seg.Via {
			if v.Visit != nil && (*v.Visit < 0 || *v.Visit >= n) {
				return publishErr(http.StatusBadRequest, "Segment %d: a via spot stands for a place visited the day doesn't have.", i+1)
			}
		}
	}
	return nil
}

// validVisit checks the nth visit: a name, a kind, a spot on the globe, and a
// note and web link that aren't too long.
func validVisit(v *TripVisit, n int) *PublishError {
	v.Name, v.Note, v.Link, v.Place = strings.TrimSpace(v.Name), strings.TrimSpace(v.Note), strings.TrimSpace(v.Link), strings.TrimSpace(v.Place)
	if v.Name == "" || utf8.RuneCountInString(v.Name) > maxEntryTextLength {
		return publishErr(http.StatusBadRequest, "Place visited %d needs a name of up to %d characters.", n, maxEntryTextLength)
	}
	if !slices.Contains(visitKinds, v.Kind) {
		return publishErr(http.StatusBadRequest, "Place visited %d: pick what sort of place it is (%s).", n, strings.Join(visitKinds, ", "))
	}
	if v.Latitude < -90 || v.Latitude > 90 || v.Longitude < -180 || v.Longitude > 180 {
		return publishErr(http.StatusBadRequest, "Place visited %d: its latitude must be from -90 to 90 and its longitude from -180 to 180.", n)
	}
	if utf8.RuneCountInString(v.Note) > maxNoteLength {
		return publishErr(http.StatusBadRequest, "Place visited %d: keep its note to %d characters.", n, maxNoteLength)
	}
	return validLink(v.Link, n)
}

// validLink fails when link, if there is one, isn't a web address.
func validLink(link string, n int) *PublishError {
	if link == "" {
		return nil
	}
	u, err := url.Parse(link)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" || len(link) > maxLinkLength {
		return publishErr(http.StatusBadRequest, "Place visited %d: its map link should be a web address, such as https://maps.app.goo.gl/….", n)
	}
	return nil
}

// visitFeature is a place visited as a GeoJSON point.
type visitFeature struct {
	Type       string        `json:"type"`
	Geometry   visitGeometry `json:"geometry"`
	Properties visitProps    `json:"properties"`
}

// visitGeometry is a GeoJSON Point: [longitude, latitude].
type visitGeometry struct {
	Type        string     `json:"type"`
	Coordinates [2]float64 `json:"coordinates"`
}

// visitProps say what a pin is: "visit" (a line's features have a mode
// instead), the day, and the place's name, kind, note and link.
type visitProps struct {
	Feature string `json:"feature"`
	Day     string `json:"day"`
	Name    string `json:"name"`
	Kind    string `json:"kind"`
	Note    string `json:"note,omitempty"`
	Link    string `json:"link,omitempty"`
}

// visitFeatureOf is v, visited on day, as a pin.
func visitFeatureOf(day string, v TripVisit) visitFeature {
	return visitFeature{
		Type:       "Feature",
		Geometry:   visitGeometry{Type: "Point", Coordinates: [2]float64{v.Longitude, v.Latitude}},
		Properties: visitProps{Feature: "visit", Day: day, Name: v.Name, Kind: v.Kind, Note: v.Note, Link: v.Link},
	}
}

// countFeatures is how many lines and how many pins m has.
func countFeatures(m tripLinesMap) (lines, visits int) {
	for _, f := range m.Features {
		if _, ok := f.(visitFeature); ok {
			visits++
		} else {
			lines++
		}
	}
	return lines, visits
}
