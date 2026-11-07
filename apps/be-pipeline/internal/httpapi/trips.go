package httpapi

import (
	"context"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handleSaveTrip saves the body as the path's Trip, new or replacing the one
// there, as a change waiting for Commit.
func handleSaveTrip(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var trip github.Trip
		if !decodeEntryUpTo(w, r, &trip, "Trip", maxTripLineBytes) {
			return
		}
		trip.ID = r.PathValue("id")
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.SaveTrip(ctx, cfg, trip)
		writeSocialResult(w, result, err, "could not save the Trip")
	}
}

// handleDeleteTrip removes the path's Trip as a change waiting for Commit.
func handleDeleteTrip(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.DeleteTrip(ctx, cfg, r.PathValue("id"))
		writeSocialResult(w, result, err, "could not remove the Trip")
	}
}
