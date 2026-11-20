package httpapi

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// deleteImagesTimeout bounds deleting one request's images from R2.
const deleteImagesTimeout = 30 * time.Second

// maxDeleteKeys is how many images one Explore Bucket delete can take: an
// original and every resized copy, with room to spare.
const maxDeleteKeys = 20

type deleteImagesRequest struct {
	// Keys are the objects to delete: an image, or an original and its resized copies.
	Keys []string `json:"keys"`
}

// failedDelete is an image that couldn't be deleted, and why.
type failedDelete struct {
	Key     string `json:"key"`
	Message string `json:"message"`
}

type deleteImagesResponse struct {
	// Deleted are the keys that are gone from the bucket now.
	Deleted []string `json:"deleted"`
	// Failed are the keys still in the bucket, each with why.
	Failed []failedDelete `json:"failed"`
}

// handleDeleteBucketImages deletes the images at "keys" from the R2 bucket
// in Settings, for Explore Bucket. It only touches R2: photo data that points
// at the images is left as it is. It responds 200 with what was and wasn't
// deleted, even when some couldn't be.
func handleDeleteBucketImages(loadR2 func() (settings.R2, error), deleteImage deletePhotoFunc) http.HandlerFunc {
	return withBody("images to delete", 1<<16, func(w http.ResponseWriter, r *http.Request, req deleteImagesRequest) {
		if len(req.Keys) == 0 {
			writeError(w, http.StatusBadRequest, "Pick the images to delete first.")
			return
		}
		if len(req.Keys) > maxDeleteKeys {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("Delete up to %d images at once.", maxDeleteKeys))
			return
		}
		withSettings(loadR2, deleteImagesTimeout, func(ctx context.Context, w http.ResponseWriter, _ *http.Request, cfg settings.R2) {
			writeJSON(w, http.StatusOK, deleteImages(ctx, cfg, deleteImage, req.Keys))
		})(w, r)
	})
}

// deleteImages deletes each key in turn, noting which went and which didn't.
func deleteImages(ctx context.Context, cfg settings.R2, deleteImage deletePhotoFunc, keys []string) deleteImagesResponse {
	resp := deleteImagesResponse{Deleted: []string{}, Failed: []failedDelete{}}
	for _, key := range keys {
		if msg := deleteImage(ctx, cfg, key); msg != "" {
			resp.Failed = append(resp.Failed, failedDelete{Key: key, Message: msg})
			continue
		}
		resp.Deleted = append(resp.Deleted, key)
	}
	return resp
}
