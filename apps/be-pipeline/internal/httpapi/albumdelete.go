package httpapi

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handleDeleteAlbum deletes the path's album, takes it out of every photo
// that lists it, and moves the albums inside it up to its parent, as changes
// waiting for Commit.
func handleDeleteAlbum(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.DeleteAlbum(ctx, cfg, r.PathValue("id"))
		writeSocialResult(w, result, err, "could not delete the album")
	}
}

// handleRemoveAlbumPhotos takes the body's photoIds out of the path's album:
// out of each photo's albums and the album's photo order, covers and layout,
// as changes waiting for Commit.
func handleRemoveAlbumPhotos(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			PhotoIDs []int `json:"photoIds"`
		}
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxPhotoDataBytes))
		dec.DisallowUnknownFields()
		if err := dec.Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid photos to remove body")
			return
		}
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.RemoveAlbumPhotos(ctx, cfg, r.PathValue("id"), req.PhotoIDs)
		writeSocialResult(w, result, err, "could not remove the photos from the album")
	}
}
