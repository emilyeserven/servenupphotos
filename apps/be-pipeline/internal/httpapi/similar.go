package httpapi

import (
	"context"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handleFindSimilarPhotos works out every photo's most related photos and
// saves their IDs in its "similarPhotos", as changes waiting for Commit.
func handleFindSimilarPhotos(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, baseURLTimeout, "Couldn't save the related photos.", func(ctx context.Context, _ *http.Request, cfg settings.GitHub) (any, error) {
		return gh.FindSimilarPhotos(ctx, cfg)
	})
}

// handleSetPickedSimilar saves the photos picked by hand to show first in one
// photo's More like this drawer, as a change waiting for Commit.
func handleSetPickedSimilar(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBody(store, baseURLTimeout, "picked photos", "Couldn't save the picked photos.",
		func(ctx context.Context, _ *http.Request, cfg settings.GitHub, req github.PickedSimilar) (any, error) {
			return gh.SetPickedSimilar(ctx, cfg, req)
		})
}
