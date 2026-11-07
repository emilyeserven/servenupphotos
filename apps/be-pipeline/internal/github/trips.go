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

// tripIDPrefix starts the ID of every Trip file. Trips are kept in the trip
// lines folder, next to the days' lines, so they're combined, listed as
// changes and committed like them; a day's file is named by its date, so the
// two never meet.
const tripIDPrefix = "trip-"

// The ways a Trip's leg between days can be travelled.
const (
	ModeFerry  = "ferry"
	ModeFlight = "flight"
)

// legModes are the modes a Trip's leg can have.
var legModes = []string{ModeFerry, ModeFlight, ModeTrain, ModeBus, ModeCar}

// maxTripLegs is the most legs a Trip can have.
const maxTripLegs = 50

// Trip is a Trip file: a run of days and the legs travelled between them,
// such as the ferry from Busan to Fukuoka, which a day's line can't hold.
type Trip struct {
	// ID is "trip-" and a slug, such as "trip-korea-japan-2026", also its file name.
	ID string `json:"id"`
	// Name names the Trip, such as "Korea and Japan".
	Name string `json:"name"`
	// Start and End are its first and last days, such as "2026-09-20".
	Start string `json:"start"`
	End   string `json:"end"`
	// Legs are the stretches between days, in the order they were travelled.
	Legs []TripLeg `json:"legs"`
}

// TripLeg is one stretch of a Trip from one day to another, such as a ferry
// or a flight.
type TripLeg struct {
	// Mode is how it was travelled: one of legModes.
	Mode string `json:"mode"`
	// From is where it left from, and To where it arrived.
	From TripLegEnd `json:"from"`
	To   TripLegEnd `json:"to"`
}

// TripLegEnd is one end of a leg: a day of the Trip, and the spot on it.
type TripLegEnd struct {
	// Day is the day it left or arrived, within the Trip. Days can be
	// skipped, such as a flight out on the first day and home on the last.
	Day string `json:"day"`
	// Spot is a spot with no photo, such as an airport or "Home". Nil uses
	// the day's photos: the last one taken for where it left, the first for
	// where it arrived.
	Spot *TripPoint `json:"spot,omitempty"`
}

// SaveTrip saves trip as <folder>/triplines/<id>.json, new or replacing the
// one there, in the pending changes. It fails when the trip isn't valid or
// its days overlap another Trip's.
func (c *Client) SaveTrip(ctx context.Context, gh settings.GitHub, trip Trip) (EntryResult, error) {
	trip, perr := validTrip(trip)
	if perr != nil {
		return EntryResult{}, perr
	}
	return c.saveEntry(ctx, gh, TripLines, trip.ID, trip, func(others []Entry) *PublishError {
		return overlappingTrip(trip, tripsIn(others))
	})
}

// DeleteTrip removes the Trip file id in the pending changes.
func (c *Client) DeleteTrip(ctx context.Context, gh settings.GitHub, id string) (EntryResult, error) {
	if !isTripID(id) {
		return EntryResult{}, publishErr(http.StatusBadRequest, "That isn't a Trip.")
	}
	return c.deleteEntry(ctx, gh, TripLines, id, func([]Entry) *PublishError { return nil })
}

// isTripID is whether id names a Trip file rather than a day's line.
func isTripID(id string) bool {
	return strings.HasPrefix(id, tripIDPrefix)
}

// validTrip checks trip and returns it trimmed, as it will be saved.
func validTrip(trip Trip) (Trip, *PublishError) {
	trip.ID = strings.TrimSpace(trip.ID)
	trip.Name = strings.TrimSpace(trip.Name)
	if !isTripID(trip.ID) {
		return trip, publishErr(http.StatusBadRequest, "Start a Trip's ID with %q.", tripIDPrefix)
	}
	if perr := validEntryID("Trip", trip.ID); perr != nil {
		return trip, perr
	}
	if trip.Name == "" || utf8.RuneCountInString(trip.Name) > maxEntryTextLength {
		return trip, publishErr(http.StatusBadRequest, "Give the Trip a name of up to %d characters.", maxEntryTextLength)
	}
	if perr := validTripDays(trip); perr != nil {
		return trip, perr
	}
	return trip, validLegs(trip)
}

// validTripDays fails unless the Trip's first and last days are dates, in order.
func validTripDays(trip Trip) *PublishError {
	start, err1 := time.Parse(labelDateLayout, trip.Start)
	end, err2 := time.Parse(labelDateLayout, trip.End)
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
	for _, spot := range []*TripPoint{leg.From.Spot, leg.To.Spot} {
		if perr := validTripPoint(spot, n); perr != nil {
			return publishErr(http.StatusBadRequest, "Leg %s", strings.TrimPrefix(perr.Message, "Segment "))
		}
	}
	return nil
}

// inTrip is whether day is a date from the Trip's first day to its last.
func inTrip(trip Trip, day string) bool {
	_, err := time.Parse(labelDateLayout, day)
	return err == nil && day >= trip.Start && day <= trip.End
}

// tripsIn is the Trips among entries that can be read.
func tripsIn(entries []Entry) []Trip {
	var out []Trip
	for _, e := range entries {
		var trip Trip
		if e.Error == "" && json.Unmarshal(e.Data, &trip) == nil && isTripID(trip.ID) {
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
			return publishErr(http.StatusConflict, "%q already covers some of these days (%s to %s).", o.Name, o.Start, o.End)
		}
	}
	return nil
}
