package httpapi

import (
	"context"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handleSavePhotoSet saves the body as the path's Photo Set, new or
// replacing the one there, as a change waiting for Commit.
func handleSavePhotoSet(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBody(store, publishTimeout, "Photo Set", "Couldn't save the Photo Set.",
		func(ctx context.Context, r *http.Request, cfg settings.GitHub, set github.PhotoSet) (any, error) {
			set.ID = r.PathValue("id")
			return gh.SavePhotoSet(ctx, cfg, set)
		})
}

// handleDeletePhotoSet removes the path's Photo Set as a change waiting for
// Commit.
func handleDeletePhotoSet(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, publishTimeout, "Couldn't remove the Photo Set.", func(ctx context.Context, r *http.Request, cfg settings.GitHub) (any, error) {
		return gh.DeletePhotoSet(ctx, cfg, r.PathValue("id"))
	})
}
