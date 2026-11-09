package github

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// dayLayout is how a Trip, a day's line and a day's story write a day.
const dayLayout = "2006-01-02"

// legacyTripPrefix starts the ID of a Trip saved before Trips and timeline
// labels became one thing, when Trips were kept in the trip lines folder as
// trip-<slug>.json. Such a file is still read, so nothing saved then is lost,
// and saving the Trip again moves it to the timeline folder.
const legacyTripPrefix = "trip-"

// The ways a Trip's leg between days can be travelled.
const (
	ModeFerry  = "ferry"
	ModeFlight = "flight"
)

// legModes are the modes a Trip's leg can have.
var legModes = []string{ModeFerry, ModeFlight, ModeTrain, ModeBus, ModeCar}

// maxTripLegs is the most legs a Trip can have.
const maxTripLegs = 50

// Trip is a Trip file, timeline/<id>.json: a name for a run of days, such as
// "Japan", which the portfolio's Timeline shows beside those days, and the
// legs travelled between them, such as the ferry from Busan to Fukuoka, which
// a day's line can't hold. A day's story on any of its days puts the day on
// the Trip's page.
type Trip struct {
	// ID is made from the name and first day, such as "japan-2026-09-22",
	// also its file name.
	ID string `json:"id"`
	// Name names the Trip, such as "Japan", as the Timeline shows it.
	Name string `json:"name"`
	// Start and End are its first and last days, both included, such as
	// "2026-09-22".
	Start string `json:"start"`
	End   string `json:"end"`
	// Legs are the stretches between days, in the order they were travelled.
	// Left out of the file when there are none, as a label was written.
	Legs []TripLeg `json:"legs,omitempty"`
	// Labels name parts of the Trip on the Timeline, such as "Korea" and
	// "Japan" in a "Korea and Japan" Trip, each on the days picked for it. A
	// day no label covers shows the Trip's name. Left out when there are none.
	Labels []TripLabel `json:"labels,omitempty"`
}

// TripLabel is a timeline label within a Trip: a name the Timeline shows
// beside the days from Start to End, both included, in place of the Trip's.
type TripLabel struct {
	// Name is what the Timeline shows, such as "Japan".
	Name string `json:"name"`
	// Start and End are the first and last days it covers, within the Trip.
	Start string `json:"start"`
	End   string `json:"end"`
}

// TripLeg is one stretch of a Trip from one day to another, such as a ferry
// or a flight.
type TripLeg struct {
	// Mode is how it was travelled: one of legModes.
	Mode string `json:"mode"`
	// From is where it left from, and To where it arrived.
	From TripLegEnd `json:"from"`
	To   TripLegEnd `json:"to"`
	// Line is the train, bus or ferry line ridden, picked from the ones
	// OpenStreetMap maps between its ends; nil when not picked.
	Line *TripTransitLine `json:"line,omitempty"`
	// Path is the line's track between the leg's ends, each [longitude,
	// latitude], drawn instead of a straight line; none without a Line.
	Path [][2]float64 `json:"path,omitempty"`
}

// legLineModes are the leg modes that can ride a mapped line.
var legLineModes = map[string]bool{ModeTrain: true, ModeBus: true, ModeFerry: true}

// TripLegEnd is one end of a leg: a day of the Trip, and the spot on it.
type TripLegEnd struct {
	// Day is the day it left or arrived, within the Trip. Days can be
	// skipped, such as a flight out on the first day and home on the last.
	Day string `json:"day"`
	// Spot is a spot with no photo, such as an airport or "Home". Nil uses
	// the day's photos: Photo when set, or else the last one taken for where
	// it left and the first for where it arrived.
	Spot *TripPoint `json:"spot,omitempty"`
	// Photo is the ID of the day's photo the leg leaves from or arrives at,
	// such as one taken at the airport, so a day can have several legs from
	// different spots. 0 uses the day's last or first photo.
	Photo int `json:"photo,omitempty"`
	// Station is the station a train, bus or ferry leg got on or off at near
	// its photo, such as a ferry terminal a short walk away: the leg runs from
	// there, with a walk from the photo. Dropped with a Spot, which is the
	// station itself, or for a leg that rides no line.
	Station *TripPoint `json:"station,omitempty"`
}

// SaveTrip saves trip as <folder>/timeline/<id>.json, new or replacing the
// one there, in the pending changes. It fails when the trip isn't valid or
// its days overlap another Trip's, so each day has at most one. A Trip saved
// in the trip lines folder before is moved.
func (c *Client) SaveTrip(ctx context.Context, gh settings.GitHub, trip Trip) (EntryResult, error) {
	trip, perr := validTrip(trip)
	if perr != nil {
		return EntryResult{}, perr
	}
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return EntryResult{}, perr
	}
	legacy := legacyTripsIn(w.entries(TripLines))
	result, err := c.saveEntry(ctx, gh, Trips, trip.ID, trip, func(others []Entry) *PublishError {
		return overlappingTrip(trip, append(tripsIn(others), legacy...))
	})
	if err != nil {
		return result, err
	}
	return result, c.dropLegacyTrip(ctx, gh, legacy, trip.ID)
}

// DeleteTrip removes the Trip file id in the pending changes, from the
// timeline folder or, for one saved before, the trip lines folder.
func (c *Client) DeleteTrip(ctx context.Context, gh settings.GitHub, id string) (EntryResult, error) {
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return EntryResult{}, perr
	}
	kind := Trips
	if hasTrip(legacyTripsIn(w.entries(TripLines)), id) {
		kind = TripLines
	}
	return c.deleteEntry(ctx, gh, kind, id, func([]Entry) *PublishError { return nil })
}

// dropLegacyTrip removes the Trip id from the trip lines folder when it was
// saved there before, now that it's saved in the timeline folder.
func (c *Client) dropLegacyTrip(ctx context.Context, gh settings.GitHub, legacy []Trip, id string) error {
	if !hasTrip(legacy, id) {
		return nil
	}
	_, err := c.deleteEntry(ctx, gh, TripLines, id, func([]Entry) *PublishError { return nil })
	return err
}

// hasTrip is whether one of trips has the ID.
func hasTrip(trips []Trip, id string) bool {
	return slices.ContainsFunc(trips, func(t Trip) bool { return t.ID == id })
}

// validTrip checks trip and returns it trimmed, as it will be saved.
func validTrip(trip Trip) (Trip, *PublishError) {
	trip.ID = strings.TrimSpace(trip.ID)
	trip.Name = strings.TrimSpace(trip.Name)
	trip.Start = strings.TrimSpace(trip.Start)
	trip.End = strings.TrimSpace(trip.End)
	if perr := validEntryID(Trips.Name, trip.ID); perr != nil {
		return trip, perr
	}
	if trip.Name == "" || utf8.RuneCountInString(trip.Name) > maxEntryTextLength {
		return trip, publishErr(http.StatusBadRequest, "Give the Trip a name of up to %d characters.", maxEntryTextLength)
	}
	if perr := validTripDays(trip); perr != nil {
		return trip, perr
	}
	if perr := validLabels(trip); perr != nil {
		return trip, perr
	}
	return trip, validLegs(trip)
}

// validTripDays fails unless the Trip's first and last days are dates, in order.
func validTripDays(trip Trip) *PublishError {
	start, err1 := time.Parse(dayLayout, trip.Start)
	end, err2 := time.Parse(dayLayout, trip.End)
	if err1 != nil || err2 != nil || end.Before(start) {
		return publishErr(http.StatusBadRequest, "Give the Trip's first and last days as dates, such as 2026-09-20, the first one first.")
	}
	return nil
}

// validLegs checks the Trip's legs, trimming their spots' labels.
func validLegs(trip Trip) *PublishError {
	if len(trip.Legs) > maxTripLegs {
		return publishErr(http.StatusBadRequest, "Keep a Trip to %d legs.", maxTripLegs)
	}
	for i := range trip.Legs {
		if perr := validLeg(trip, &trip.Legs[i], i+1); perr != nil {
			return perr
		}
	}
	return nil
}

// validLeg checks the nth leg of trip.
func validLeg(trip Trip, leg *TripLeg, n int) *PublishError {
	if !slices.Contains(legModes, leg.Mode) {
		return publishErr(http.StatusBadRequest, "Leg %d: pick how it was travelled (%s).", n, strings.Join(legModes, ", "))
	}
	if !inTrip(trip, leg.From.Day) || !inTrip(trip, leg.To.Day) || leg.To.Day < leg.From.Day {
		return publishErr(http.StatusBadRequest, "Leg %d: pick the days it left and arrived, within the Trip, leaving first.", n)
	}
	if leg.From.Photo < 0 || leg.To.Photo < 0 {
		return publishErr(http.StatusBadRequest, "Leg %d: pick a photo from the list.", n)
	}
	dropStations(leg)
	for _, spot := range []*TripPoint{leg.From.Spot, leg.To.Spot, leg.From.Station, leg.To.Station} {
		if perr := validTripPoint(spot, n); perr != nil {
			return asLegError(perr)
		}
	}
	return validLegLine(leg, n)
}

// dropStations drops a station near the photo from each of leg's ends that
// is at a spot, or from both when the leg rides no line.
func dropStations(leg *TripLeg) {
	for _, end := range []*TripLegEnd{&leg.From, &leg.To} {
		if end.Spot != nil || !legLineModes[leg.Mode] {
			end.Station = nil
		}
	}
}

// validLegLine drops the nth leg's line and path when its mode rides no
// line, and checks the ones it keeps.
func validLegLine(leg *TripLeg, n int) *PublishError {
	if !legLineModes[leg.Mode] || leg.Line == nil {
		leg.Line, leg.Path = nil, nil
	}
	if perr := validLine(leg.Line, n); perr != nil {
		return asLegError(perr)
	}
	leg.Path = roundPath(leg.Path)
	if perr := validPath(leg.Path, n); perr != nil {
		return asLegError(perr)
	}
	return nil
}

// asLegError is a segment's error as the same leg's: "Leg 2: …".
func asLegError(perr *PublishError) *PublishError {
	return publishErr(http.StatusBadRequest, "Leg %s", strings.TrimPrefix(perr.Message, "Segment "))
}

// inTrip is whether day is a date from the Trip's first day to its last.
func inTrip(trip Trip, day string) bool {
	_, err := time.Parse(dayLayout, day)
	return err == nil && day >= trip.Start && day <= trip.End
}

// tripsIn is the Trips among the timeline folder's entries that can be read.
func tripsIn(entries []Entry) []Trip {
	var out []Trip
	for _, e := range entries {
		var trip Trip
		if e.Error == "" && json.Unmarshal(e.Data, &trip) == nil && trip.ID != "" && trip.Start != "" {
			out = append(out, trip)
		}
	}
	return out
}

// legacyTripsIn is the Trips saved in the trip lines folder before Trips
// moved to the timeline folder, among that folder's entries.
func legacyTripsIn(entries []Entry) []Trip {
	var out []Trip
	for _, trip := range tripsIn(entries) {
		if strings.HasPrefix(trip.ID, legacyTripPrefix) {
			out = append(out, trip)
		}
	}
	return out
}

// allTrips is every Trip in w: those in the timeline folder, and those saved
// in the trip lines folder before that aren't in it.
func (w *workspace) allTrips() []Trip {
	out := tripsIn(w.entries(Trips))
	for _, trip := range legacyTripsIn(w.entries(TripLines)) {
		if !hasTrip(out, trip.ID) {
			out = append(out, trip)
		}
	}
	return out
}

// overlappingTrip fails when trip shares a day with one of others, other
// than the file it replaces.
func overlappingTrip(trip Trip, others []Trip) *PublishError {
	for _, o := range others {
		if o.ID != trip.ID && o.Start <= trip.End && trip.Start <= o.End {
			return publishErr(http.StatusConflict, "%q already covers %s to %s. Pick days outside it, or change that Trip first.", o.Name, o.Start, o.End)
		}
	}
	return nil
}
