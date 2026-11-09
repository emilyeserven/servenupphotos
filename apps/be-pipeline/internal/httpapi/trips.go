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
	return withGitHubBodyUpTo(store, publishTimeout, "Trip", maxTripLineBytes, "could not save the Trip",
		func(ctx context.Context, r *http.Request, cfg settings.GitHub, trip github.Trip) (any, error) {
			trip.ID = r.PathValue("id")
			return gh.SaveTrip(ctx, cfg, trip)
		})
}

// handleDeleteTrip removes the path's Trip as a change waiting for Commit.
func handleDeleteTrip(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, publishTimeout, "could not remove the Trip", func(ctx context.Context, r *http.Request, cfg settings.GitHub) (any, error) {
		return gh.DeleteTrip(ctx, cfg, r.PathValue("id"))
	})
}

// combineBody is what combining Trips sends: the combined Trip, and the IDs
// of the Trips it replaces.
type combineBody struct {
	Trip github.Trip `json:"trip"`
	IDs  []string    `json:"ids"`
}

// handleCombineTrips saves the body's Trip in place of the Trips it names,
// as one change waiting for Commit.
func handleCombineTrips(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBodyUpTo(store, publishTimeout, "Trip", maxTripLineBytes, "could not combine the Trips",
		func(ctx context.Context, _ *http.Request, cfg settings.GitHub, body combineBody) (any, error) {
			return gh.CombineTrips(ctx, cfg, body.Trip, body.IDs)
		})
}
