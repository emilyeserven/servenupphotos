package httpapi

import (
	"context"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// maxTripLineBytes is the largest trip line body: its paths along streets
// can run to thousands of points.
const maxTripLineBytes = 4 << 20

// handleSaveTripLine saves the body as the path's day's trip line, new or
// replacing the one there, as a change waiting for Commit.
func handleSaveTripLine(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBodyUpTo(store, publishTimeout, "trip line", maxTripLineBytes, "could not save the trip line",
		func(ctx context.Context, r *http.Request, cfg settings.GitHub, line github.TripLine) (any, error) {
			line.ID = r.PathValue("day")
			return gh.SaveTripLine(ctx, cfg, line)
		})
}

// handleDeleteTripLine removes the path's day's trip line as a change waiting
// for Commit.
func handleDeleteTripLine(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, publishTimeout, "could not remove the trip line", func(ctx context.Context, r *http.Request, cfg settings.GitHub) (any, error) {
		return gh.DeleteTripLine(ctx, cfg, r.PathValue("day"))
	})
}

// handleAutoTripLine answers the path's day's automatic trip line, as the
// next Commit would draw it, for the pipeline to preview.
func handleAutoTripLine(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, publishTimeout, "could not work out the automatic trip line", func(ctx context.Context, r *http.Request, cfg settings.GitHub) (any, error) {
		return gh.AutoTripLine(ctx, cfg, r.PathValue("day"))
	})
}

// handleRouteTripLine answers the body, the path's day's trip line, with its
// walks, bus rides and drives snapped to streets by route, without saving it.
func handleRouteTripLine(store *settings.Store, gh *github.Client, route github.RouteFunc) http.HandlerFunc {
	return withGitHubBodyUpTo(store, publishTimeout, "trip line", maxTripLineBytes, "could not snap the trip line to streets",
		func(ctx context.Context, r *http.Request, cfg settings.GitHub, line github.TripLine) (any, error) {
			line.ID = r.PathValue("day")
			return gh.RouteTripLine(ctx, cfg, line, route)
		})
}
