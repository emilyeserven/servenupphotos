package httpapi

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/versions"
)

// deletePhotoResponse says what deleting a photo did: the files saved in the
// pending changes, and what happened to its images in R2.
type deletePhotoResponse struct {
	github.DeletedPhoto
	Image removedImage `json:"image"`
	// Original is what happened to the photo's unedited original and its
	// versions, or nil when it has none.
	Original *removedImage `json:"original,omitempty"`
}

// handleDeletePhoto deletes the photo JSON at the "path" query parameter, new
// or already in the portfolio, and takes it out of every file that points at
// it, as changes waiting for Commit (github.DeletePhoto). Then it deletes its
// image, every resized version and its unedited original from R2 right away.
// Once the JSON is saved it responds 200 even if an image couldn't be
// deleted, saying why in "image" or "original".
func handleDeletePhoto(store *settings.Store, gh *github.Client, findPhotos findPhotosFunc, deletePhoto deletePhotoFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		file := r.URL.Query().Get("path")
		if file == "" {
			writeError(w, http.StatusBadRequest, "path is required")
			return
		}
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		deleted, err := gh.DeletePhoto(ctx, cfg, file)
		if err != nil {
			writeResult(w, nil, err, "could not delete the photo")
			return
		}
		resp := deletePhotoResponse{DeletedPhoto: deleted}
		resp.Image, resp.Original = deletedImages(r.Context(), store, findPhotos, deletePhoto, deleted)
		writeJSON(w, http.StatusOK, resp)
	}
}

// deletedImages deletes deleted's image and its versions from R2, then its
// unedited original's, and says how each went.
func deletedImages(ctx context.Context, store *settings.Store, findPhotos findPhotosFunc, deletePhoto deletePhotoFunc, deleted github.DeletedPhoto) (removedImage, *removedImage) {
	image, err := removeImage(ctx, store, findPhotos, deletePhoto, deleted.RemovedFile)
	if err != nil {
		slog.Error("read settings failed", "err", err)
		return removedImage{Message: "Couldn't read the R2 settings, so the images were left in R2."}, nil
	}
	if deleted.OriginalKey == "" {
		return image, nil
	}
	cfg, _ := store.R2()
	ctx, cancel := context.WithTimeout(ctx, deleteImagesTimeout)
	defer cancel()
	original := deleteImage(ctx, cfg, deletePhoto, deleted.OriginalKey)
	for _, v := range versions.Published() {
		original.Versions = append(original.Versions, deleteImage(ctx, cfg, deletePhoto, storage.VersionKey(deleted.OriginalKey, v.Name)))
	}
	return image, &original
}
