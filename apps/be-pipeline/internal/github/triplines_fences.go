package github

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/areas"
)

// TripFence is an area, such as a park or a neighbourhood, that photos
// without an exact spot were taken somewhere in, shown on the map as a shaded
// area instead of points.
type TripFence struct {
	// Name is what the area is called, such as "Osaka Castle Park".
	Name string `json:"name"`
	// Photos are the IDs of the photos taken in it.
	Photos []int `json:"photos"`
	// OSM is the area's OpenStreetMap ID, such as "R358674", when it was
	// looked up there; "" for none.
	OSM string `json:"osm,omitempty"`
	// Shape is the area's outline, as a GeoJSON MultiPolygon's coordinates.
	Shape areas.Shape `json:"shape"`
}

// Limits on a day's fences: how many, and how many photos each holds.
const (
	maxFences      = 20
	maxFencePhotos = 200
)

// validFences checks each fence and trims its name in place.
func validFences(fences []TripFence) *PublishError {
	if len(fences) > maxFences {
		return publishErr(http.StatusBadRequest, "Keep a day to %d areas.", maxFences)
	}
	for i := range fences {
		if perr := validFence(&fences[i], i+1); perr != nil {
			return perr
		}
	}
	return nil
}

// validFence checks the nth fence: a name, some photos, and an outline.
func validFence(f *TripFence, n int) *PublishError {
	f.Name = strings.TrimSpace(f.Name)
	if f.Name == "" || utf8.RuneCountInString(f.Name) > maxEntryTextLength {
		return publishErr(http.StatusBadRequest, "Area %d needs a name of up to %d characters.", n, maxEntryTextLength)
	}
	if len(f.Photos) == 0 || len(f.Photos) > maxFencePhotos {
		return publishErr(http.StatusBadRequest, "Area %d: put 1 to %d photos in it.", n, maxFencePhotos)
	}
	return validShape(f.Shape, fmt.Sprintf("Area %d", n))
}

// validShape fails unless shape is an outline on the globe of up to
// areas.MaxPoints points, each ring closed. what names it in the message,
// such as "Area 2".
func validShape(shape areas.Shape, what string) *PublishError {
	if len(shape) == 0 || areas.Points(shape) > areas.MaxPoints {
		return publishErr(http.StatusBadRequest, "%s needs an outline of up to %d points.", what, areas.MaxPoints)
	}
	for _, polygon := range shape {
		for _, ring := range polygon {
			if !validRing(ring) {
				return publishErr(http.StatusBadRequest, "%s: its outline has a ring that isn't closed or is off the globe.", what)
			}
		}
	}
	return nil
}

// validRing reports whether ring has 4 or more points on the globe and ends
// where it starts.
func validRing(ring [][2]float64) bool {
	if len(ring) < 4 || ring[0] != ring[len(ring)-1] {
		return false
	}
	for _, p := range ring {
		if p[0] < -180 || p[0] > 180 || p[1] < -90 || p[1] > 90 {
			return false
		}
	}
	return true
}

// checkFencePhotos fails when a fence's photo wasn't taken on line's day, by
// days (each photo's day, by ID).
func checkFencePhotos(line TripLine, days map[int]string) *PublishError {
	for i, f := range line.Fences {
		for _, id := range f.Photos {
			if day, ok := days[id]; !ok || day != line.Day {
				return publishErr(http.StatusBadRequest, "Area %d: photo %d wasn't taken on %s.", i+1, id, line.Day)
			}
		}
	}
	return nil
}

// photoDays is the day each photo in w with an ID and a date was taken, by
// ID, whether or not it has an exact spot.
func (w *workspace) photoDays() map[int]string {
	days := map[int]string{}
	for _, p := range w.paths(w.root+"/"+PhotosFolder, AllPhotosFile) {
		data, msg := w.json(p)
		var photo tripPhoto
		if msg != "" || json.Unmarshal(data, &photo) != nil || photo.ID == nil {
			continue
		}
		if taken, ok := photoTaken(photo); ok {
			days[*photo.ID] = taken.Format(dayLayout)
		}
	}
	return days
}

// fenceFeature is a fence as a GeoJSON MultiPolygon.
type fenceFeature struct {
	Type       string        `json:"type"`
	Geometry   fenceGeometry `json:"geometry"`
	Properties fenceProps    `json:"properties"`
}

// fenceGeometry is a GeoJSON MultiPolygon.
type fenceGeometry struct {
	Type        string      `json:"type"`
	Coordinates areas.Shape `json:"coordinates"`
}

// fenceProps say what a fence is: "fence", so the map tells it from lines and
// pins, its day, its name and its photos.
type fenceProps struct {
	Feature string `json:"feature"`
	Day     string `json:"day"`
	Name    string `json:"name"`
	Photos  []int  `json:"photos"`
}

// fenceFeatureOf is fence f of day as a feature.
func fenceFeatureOf(day string, f TripFence) fenceFeature {
	return fenceFeature{
		Type:       "Feature",
		Geometry:   fenceGeometry{Type: "MultiPolygon", Coordinates: f.Shape},
		Properties: fenceProps{Feature: "fence", Day: day, Name: f.Name, Photos: f.Photos},
	}
}

// featureCounts is how many of each the map has: segments' lines
// ("tripLineSegments"), places visited's pins ("tripLineVisits") and fences
// ("tripLineFences"), and Trips' legs between days ("tripLegs").
func featureCounts(m tripLinesMap) map[string]int {
	counts := map[string]int{"tripLineSegments": 0, "tripLineVisits": 0, "tripLineFences": 0, "tripLegs": 0}
	for _, f := range m.Features {
		counts[featureCount(f)]++
	}
	return counts
}

// featureCount is the count f adds to.
func featureCount(f any) string {
	switch v := f.(type) {
	case visitFeature:
		return "tripLineVisits"
	case fenceFeature:
		return "tripLineFences"
	case tripLineFeature:
		return lineCount(v)
	default:
		return "tripLineSegments"
	}
}

// lineCount is the count a line adds to: a Trip's leg, or a day's segment.
func lineCount(f tripLineFeature) string {
	if f.Properties.Trip != "" {
		return "tripLegs"
	}
	return "tripLineSegments"
}
