package github

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// CombineResult is what combining Trips saved: the combined Trip's file, and
// every file changed, the Trips combined among them as removed.
type CombineResult struct {
	pendingSave
	Path string          `json:"path"`
	Data json.RawMessage `json:"data"`
}

// CombineTrips saves trip, which combines the Trips named in ids, and removes
// those Trips, in one save to the pending changes, so their days are never
// covered twice or not at all in between. trip can reuse one of their IDs.
// It fails when fewer than two Trips are named, one is missing, or trip
// isn't valid or overlaps a Trip it doesn't combine.
func (c *Client) CombineTrips(ctx context.Context, gh settings.GitHub, trip Trip, ids []string) (CombineResult, error) {
	trip, perr := validTrip(trip)
	if perr != nil {
		return CombineResult{}, perr
	}
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return CombineResult{}, perr
	}
	removed, perr := combinedTripFiles(w, ids)
	if perr != nil {
		return CombineResult{}, perr
	}
	if perr := overlappingTrip(trip, tripsOutside(w.allTrips(), ids)); perr != nil {
		return CombineResult{}, perr
	}
	return c.saveCombined(w, trip, removed)
}

// saveCombined saves trip and removes the files of the Trips it combines.
func (c *Client) saveCombined(w *workspace, trip Trip, removed []ScanChange) (CombineResult, error) {
	b, err := json.MarshalIndent(trip, "", "  ")
	if err != nil {
		return CombineResult{}, publishErr(http.StatusInternalServerError, "Couldn't encode the Trip.")
	}
	file := w.root + "/" + Trips.Folder + "/" + trip.ID + ".json"
	changes := withoutPath(removed, file)
	before, _ := splitEntry(w.entries(Trips), file)
	changes = append(changes, ScanChange{Path: file, Before: before, After: append(b, '\n')})
	saved, perr := c.saveFiles(w, changes)
	if perr != nil {
		return CombineResult{}, perr
	}
	return CombineResult{pendingSave: saved, Path: file, Data: changes[len(changes)-1].After}, nil
}

// combinedTripFiles is the removal of each Trip in ids, from the timeline folder
// or, for one saved before, the trip lines folder. It fails unless there are
// at least two, each a Trip.
func combinedTripFiles(w *workspace, ids []string) ([]ScanChange, *PublishError) {
	if len(ids) < 2 {
		return nil, publishErr(http.StatusBadRequest, "Pick at least two Trips to combine.")
	}
	entries := append(w.entries(Trips), w.entries(TripLines)...)
	out := make([]ScanChange, 0, len(ids))
	for _, id := range ids {
		e, ok := tripEntry(entries, id)
		if !ok {
			return nil, publishErr(http.StatusNotFound, "There's no Trip with the ID %q.", id)
		}
		out = append(out, ScanChange{Path: e.Path, Before: e.Data})
	}
	return out, nil
}

// tripEntry is the entry of the Trip id among entries.
func tripEntry(entries []Entry, id string) (Entry, bool) {
	for _, e := range entries {
		var trip Trip
		if e.Error == "" && json.Unmarshal(e.Data, &trip) == nil && trip.ID == id && trip.Start != "" {
			return e, true
		}
	}
	return Entry{}, false
}

// tripsOutside is the trips whose IDs aren't in ids.
func tripsOutside(trips []Trip, ids []string) []Trip {
	return slices.DeleteFunc(slices.Clone(trips), func(t Trip) bool { return slices.Contains(ids, t.ID) })
}

// withoutPath is changes without the one for file, which the combined Trip
// replaces rather than removes when it keeps that Trip's ID.
func withoutPath(changes []ScanChange, file string) []ScanChange {
	return slices.DeleteFunc(slices.Clone(changes), func(ch ScanChange) bool { return ch.Path == file })
}
