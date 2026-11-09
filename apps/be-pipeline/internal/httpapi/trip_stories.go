package httpapi

import (
	"context"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handleSaveTripStory saves the body as the path's day's story for the
// portfolio's Trip page, new or replacing the one there, as a change waiting
// for Commit.
func handleSaveTripStory(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBodyUpTo(store, publishTimeout, "story", maxTripLineBytes, "could not save the story",
		func(ctx context.Context, r *http.Request, cfg settings.GitHub, story github.TripStory) (any, error) {
			story.ID = r.PathValue("id")
			return gh.SaveTripStory(ctx, cfg, story)
		})
}

// handleDeleteTripStory removes the path's day's story as a change waiting
// for Commit.
func handleDeleteTripStory(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, publishTimeout, "could not remove the story", func(ctx context.Context, r *http.Request, cfg settings.GitHub) (any, error) {
		return gh.DeleteTripStory(ctx, cfg, r.PathValue("id"))
	})
}
