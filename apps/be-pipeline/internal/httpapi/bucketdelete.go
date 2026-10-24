package httpapi

import (
	"context"
	"encoding/json"
	"log/slog"
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
	return func(w http.ResponseWriter, r *http.Request) {
		var req deleteImagesRequest
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<16)).Decode(&req); err != nil || len(req.Keys) == 0 {
			writeError(w, http.StatusBadRequest, "keys is required")
			return
		}
		if len(req.Keys) > maxDeleteKeys {
			writeError(w, http.StatusBadRequest, "too many images to delete at once")
			return
		}
		cfg, err := loadR2()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), deleteImagesTimeout)
		defer cancel()
		writeJSON(w, http.StatusOK, deleteImages(ctx, cfg, deleteImage, req.Keys))
	}
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
