package httpapi

import (
	"context"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handleSaveGraphPreset saves the body as the path's graph preset or preset
// group, new or replacing the one there, as a change waiting for Commit.
func handleSaveGraphPreset(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBody(store, publishTimeout, "graph preset", "could not save the graph preset",
		func(ctx context.Context, r *http.Request, cfg settings.GitHub, preset github.GraphPreset) (any, error) {
			preset.ID = r.PathValue("id")
			return gh.SaveGraphPreset(ctx, cfg, preset)
		})
}

// handleDeleteGraphPreset removes the path's graph preset or preset group as
// a change waiting for Commit.
func handleDeleteGraphPreset(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, publishTimeout, "could not remove the graph preset", func(ctx context.Context, r *http.Request, cfg settings.GitHub) (any, error) {
		return gh.DeleteGraphPreset(ctx, cfg, r.PathValue("id"))
	})
}
