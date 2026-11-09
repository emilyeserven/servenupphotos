package httpapi

import (
	"context"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handleSaveMetaGroup saves the body as the path's metadata group, new or
// replacing the one there, as a change waiting for Commit.
func handleSaveMetaGroup(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBody(store, publishTimeout, "metadata group", "could not save the metadata group",
		func(ctx context.Context, r *http.Request, cfg settings.GitHub, group github.MetaGroup) (any, error) {
			group.ID = r.PathValue("id")
			return gh.SaveMetaGroup(ctx, cfg, group)
		})
}

// handleDeleteMetaGroup removes the path's metadata group as a change waiting
// for Commit.
func handleDeleteMetaGroup(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, publishTimeout, "could not remove the metadata group", func(ctx context.Context, r *http.Request, cfg settings.GitHub) (any, error) {
		return gh.DeleteMetaGroup(ctx, cfg, r.PathValue("id"))
	})
}
