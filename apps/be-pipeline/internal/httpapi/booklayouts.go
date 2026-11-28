package httpapi

import (
	"context"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handleSaveStandardLayouts saves the body as the photo books' standard
// layouts file, as a change waiting for Commit.
func handleSaveStandardLayouts(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBody(store, publishTimeout, "standard layouts", "Couldn't save the standard layouts.",
		func(ctx context.Context, r *http.Request, cfg settings.GitHub, layouts github.StandardLayouts) (any, error) {
			layouts.ID = r.PathValue("id")
			return gh.SaveStandardLayouts(ctx, cfg, layouts)
		})
}
