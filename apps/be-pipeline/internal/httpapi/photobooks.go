package httpapi

import (
	"context"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handleSavePhotoBook saves the body as the path's photo book, new or
// replacing the one there, as a change waiting for Commit.
func handleSavePhotoBook(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBody(store, publishTimeout, "photo book", "could not save the photo book",
		func(ctx context.Context, r *http.Request, cfg settings.GitHub, book github.PhotoBook) (any, error) {
			book.ID = r.PathValue("id")
			return gh.SavePhotoBook(ctx, cfg, book)
		})
}

// handleDeletePhotoBook removes the path's photo book as a change waiting
// for Commit.
func handleDeletePhotoBook(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, publishTimeout, "could not remove the photo book", func(ctx context.Context, r *http.Request, cfg settings.GitHub) (any, error) {
		return gh.DeletePhotoBook(ctx, cfg, r.PathValue("id"))
	})
}
