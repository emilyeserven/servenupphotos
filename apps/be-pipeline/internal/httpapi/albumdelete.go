package httpapi

import (
	"context"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handleDeleteAlbum deletes the path's album, takes it out of every photo
// that lists it, and moves the albums inside it up to its parent, as changes
// waiting for Commit.
func handleDeleteAlbum(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, publishTimeout, "could not delete the album", func(ctx context.Context, r *http.Request, cfg settings.GitHub) (any, error) {
		return gh.DeleteAlbum(ctx, cfg, r.PathValue("id"))
	})
}

// albumPhotosBody is the body of a request about some of an album's photos:
// their IDs.
type albumPhotosBody struct {
	PhotoIDs []int `json:"photoIds"`
}

// handleRemoveAlbumPhotos takes the body's photoIds out of the path's album:
// out of each photo's albums and the album's photo order, covers and layout,
// as changes waiting for Commit.
func handleRemoveAlbumPhotos(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBody(store, publishTimeout, "photos to remove", "could not remove the photos from the album",
		func(ctx context.Context, r *http.Request, cfg settings.GitHub, req albumPhotosBody) (any, error) {
			return gh.RemoveAlbumPhotos(ctx, cfg, r.PathValue("id"), req.PhotoIDs)
		})
}
