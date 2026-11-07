package github

import (
	"encoding/json"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/exif"
)

// exifDateLayout is how exiftool writes a photo's date, and how a custom date
// is written.
const exifDateLayout = "2006:01:02 15:04:05"

// tripSpot is a photo a trip line can go through: one with a date and an exact
// spot.
type tripSpot struct {
	ID int
	// Day is the day it was taken, such as "2026-09-23", and Taken when.
	Day   string
	Taken time.Time
	// Latitude and Longitude are its exact spot.
	Latitude, Longitude float64
}

// tripPhoto is the part of a photo file a trip line reads.
type tripPhoto struct {
	ID                *int    `json:"id"`
	GPSPosition       *string `json:"gpsPosition"`
	CustomGPSPosition *string `json:"customGpsPosition"`
	CreateDate        *string `json:"createDate"`
	CustomCreateDate  *string `json:"customCreateDate"`
	Places            []struct {
		ID string `json:"id"`
	} `json:"places"`
}

// tripSpots is every photo in w a trip line can go through, by ID. With
// portfolioOnly, only the photos on the portfolio (see onPortfolio) count.
func (w *workspace) tripSpots(portfolioOnly bool) map[int]tripSpot {
	exact := exactPlaces(w.entries(Places))
	spots := map[int]tripSpot{}
	for _, p := range w.paths(w.root+"/"+PhotosFolder, AllPhotosFile) {
		data, msg := w.json(p)
		if msg != "" || (portfolioOnly && !w.onPortfolio(data)) {
			continue
		}
		if spot, ok := spotOf(data, exact); ok {
			spots[spot.ID] = spot
		}
	}
	return spots
}

// spotOf is the photo file data as a tripSpot, and false when it has no ID,
// date or exact spot. exact are the places marked as an exact location.
func spotOf(data json.RawMessage, exact map[string]TripPoint) (tripSpot, bool) {
	var photo tripPhoto
	if json.Unmarshal(data, &photo) != nil || photo.ID == nil {
		return tripSpot{}, false
	}
	taken, ok := photoTaken(photo)
	if !ok {
		return tripSpot{}, false
	}
	at, ok := photoSpot(photo, exact)
	if !ok {
		return tripSpot{}, false
	}
	return tripSpot{ID: *photo.ID, Day: taken.Format(dayLayout), Taken: taken, Latitude: at.Latitude, Longitude: at.Longitude}, true
}

// photoTaken is when photo was taken: its custom date, or else its EXIF one.
func photoTaken(photo tripPhoto) (time.Time, bool) {
	for _, d := range []*string{photo.CustomCreateDate, photo.CreateDate} {
		if d == nil || len(strings.TrimSpace(*d)) < len(exifDateLayout) {
			continue
		}
		if t, err := time.Parse(exifDateLayout, strings.TrimSpace(*d)[:len(exifDateLayout)]); err == nil {
			return t, true
		}
	}
	return time.Time{}, false
}

// photoSpot is photo's exact spot: its custom GPS position, or else its EXIF
// one, or else the first of its places marked as an exact location.
func photoSpot(photo tripPhoto, exact map[string]TripPoint) (TripPoint, bool) {
	for _, g := range []*string{photo.CustomGPSPosition, photo.GPSPosition} {
		if p, ok := parseGPS(g); ok {
			return p, true
		}
	}
	for _, place := range photo.Places {
		if p, ok := exact[place.ID]; ok {
			return p, true
		}
	}
	return TripPoint{}, false
}

// exactPlaces is the GPS position of each place in entries marked as an
// exact location, by ID.
func exactPlaces(entries []Entry) map[string]TripPoint {
	out := map[string]TripPoint{}
	for _, e := range entries {
		var p Place
		if json.Unmarshal(e.Data, &p) == nil && p.ExactLocation && p.Latitude != nil && p.Longitude != nil {
			out[p.ID] = TripPoint{Latitude: *p.Latitude, Longitude: *p.Longitude}
		}
	}
	return out
}

// parseGPS reads a GPS position as exiftool writes it, or as a custom one is
// written on the Photo page ("40.7795, -73.9634").
func parseGPS(value *string) (TripPoint, bool) {
	if value == nil {
		return TripPoint{}, false
	}
	lat, lng, ok := exif.ParseGPS(*value)
	return TripPoint{Latitude: lat, Longitude: lng}, ok
}

// spotsOn is the spots taken on day, in the order they were taken.
func spotsOn(spots map[int]tripSpot, day string) []tripSpot {
	var out []tripSpot
	for _, s := range spots {
		if s.Day == day {
			out = append(out, s)
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if !out[i].Taken.Equal(out[j].Taken) {
			return out[i].Taken.Before(out[j].Taken)
		}
		return out[i].ID < out[j].ID
	})
	return out
}

// distanceKm is the distance between two spots along the Earth's surface
// (the haversine formula).
func distanceKm(aLat, aLng, bLat, bLng float64) float64 {
	const earthKm = 6371.0
	rad := math.Pi / 180
	dLat, dLng := (bLat-aLat)*rad, (bLng-aLng)*rad
	h := math.Sin(dLat/2)*math.Sin(dLat/2) + math.Cos(aLat*rad)*math.Cos(bLat*rad)*math.Sin(dLng/2)*math.Sin(dLng/2)
	return 2 * earthKm * math.Asin(math.Sqrt(h))
}
