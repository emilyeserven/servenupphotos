package httpapi

import (
	"context"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handleSaveViewerLikes saves the body as the path's viewer likes, replacing the
// list that person sent before, as a change waiting for Commit.
func handleSaveViewerLikes(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBody(store, publishTimeout, "viewer likes", "could not save the viewer's likes",
		func(ctx context.Context, r *http.Request, cfg settings.GitHub, viewer github.ViewerLikes) (any, error) {
			viewer.ID = r.PathValue("id")
			return gh.SaveViewerLikes(ctx, cfg, viewer)
		})
}

// handleDeleteViewerLikes removes the path's viewer likes as a change waiting for
// Commit.
func handleDeleteViewerLikes(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, publishTimeout, "could not remove the viewer's likes", func(ctx context.Context, r *http.Request, cfg settings.GitHub) (any, error) {
		return gh.DeleteViewerLikes(ctx, cfg, r.PathValue("id"))
	})
}
