package httpapi

import (
	"context"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handleSaveNotStoredPost saves the body as the path's day's Not Stored post,
// new or replacing the one there, as a change waiting for Commit.
func handleSaveNotStoredPost(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBody(store, publishTimeout, "Not Stored post", "could not save the Not Stored post",
		func(ctx context.Context, r *http.Request, cfg settings.GitHub, post github.NotStoredPost) (any, error) {
			post.ID = r.PathValue("day")
			return gh.SaveNotStoredPost(ctx, cfg, post)
		})
}

// handleDeleteNotStoredPost removes the path's day's Not Stored post as a
// change waiting for Commit.
func handleDeleteNotStoredPost(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, publishTimeout, "could not remove the Not Stored post", func(ctx context.Context, r *http.Request, cfg settings.GitHub) (any, error) {
		return gh.DeleteNotStoredPost(ctx, cfg, r.PathValue("day"))
	})
}
