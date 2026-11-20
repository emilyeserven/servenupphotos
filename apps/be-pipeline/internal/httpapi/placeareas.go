package httpapi

import (
	"context"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handlePlaceArea answers the path's place's area, or null when it has none.
func handlePlaceArea(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, publishTimeout, "Couldn't read the place's area.", func(ctx context.Context, r *http.Request, cfg settings.GitHub) (any, error) {
		return gh.PlaceAreaOf(ctx, cfg, r.PathValue("id"))
	})
}

// handleSavePlaceArea saves the body as the path's place's area, in the
// changes waiting for Commit.
func handleSavePlaceArea(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBodyUpTo(store, publishTimeout, "area", maxAreaBody, "Couldn't save the place's area.",
		func(ctx context.Context, r *http.Request, cfg settings.GitHub, area github.PlaceArea) (any, error) {
			return gh.SavePlaceArea(ctx, cfg, r.PathValue("id"), area)
		})
}

// maxAreaBody is the largest area body read: 5,000 points with room to spare.
const maxAreaBody = 1 << 20

// handleDeletePlaceArea removes the path's place's area, in the changes
// waiting for Commit.
func handleDeletePlaceArea(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, publishTimeout, "Couldn't remove the place's area.", func(ctx context.Context, r *http.Request, cfg settings.GitHub) (any, error) {
		return gh.DeletePlaceArea(ctx, cfg, r.PathValue("id"))
	})
}
