package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// deletePhotoFunc deletes a photo from R2; storage.DeletePhoto in production.
type deletePhotoFunc func(ctx context.Context, cfg settings.R2, key string) string

// removedImage says what happened to a removed file's image in R2.
type removedImage struct {
	// Key is the object that was deleted, or would have been.
	Key     string `json:"key,omitempty"`
	Deleted bool   `json:"deleted"`
	// Message says why the image wasn't deleted, when it wasn't. It is empty
	// when there was no image in R2, since then there was nothing to delete.
	Message string `json:"message,omitempty"`
}

type removeResponse struct {
	Path  string       `json:"path"`
	Image removedImage `json:"image"`
}

// handleRemoveInFlight deletes the photo JSON at the "path" query parameter
// from the open "Add photo data" pull request, then deletes its image from
// R2. Once the JSON is gone it responds 200 even if the image couldn't be
// deleted, saying why in "image".
func handleRemoveInFlight(store *settings.Store, gh *github.Client, findPhotos findPhotosFunc, deletePhoto deletePhotoFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		file := r.URL.Query().Get("path")
		if file == "" {
			writeError(w, http.StatusBadRequest, "path is required")
			return
		}
		cfg, err := store.GitHub()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		removed, err := gh.Remove(ctx, cfg, file)
		var perr *github.PublishError
		if errors.As(err, &perr) {
			writeError(w, perr.Status, perr.Message)
			return
		}
		if err != nil {
			slog.Error("remove photo data failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not remove photo data")
			return
		}

		image, err := removeImage(r.Context(), store, findPhotos, deletePhoto, removed)
		if err != nil {
			slog.Error("read settings failed", "err", err)
			image = removedImage{Message: "Couldn't read the R2 settings, so the image was left in R2."}
		}
		writeJSON(w, http.StatusOK, removeResponse{Path: removed.Path, Image: image})
	}
}

// removeImage deletes removed's image from the R2 bucket from Settings, the
// same image the Photos in Flight page shows for it.
func removeImage(ctx context.Context, store *settings.Store, findPhotos findPhotosFunc, deletePhoto deletePhotoFunc, removed github.RemovedFile) (removedImage, error) {
	cfg, err := store.R2()
	if err != nil {
		return removedImage{}, err
	}
	ctx, cancel := context.WithTimeout(ctx, findPhotosTimeout)
	defer cancel()

	ref := storage.PhotoRef{Name: removed.PhotoName, URL: removed.ImageURL, Key: removed.ImageKey}
	found, problem := findPhotos(ctx, cfg, []storage.PhotoRef{ref})
	if problem != "" {
		return removedImage{Message: "Couldn't look in R2, so the image was left there: " + problem}, nil
	}
	u, ok := found[ref]
	switch {
	case !ok:
		return removedImage{}, nil
	case u.Key == "":
		return removedImage{Message: "The image is outside the R2 bucket, so it was left as is."}, nil
	}
	if problem := deletePhoto(ctx, cfg, u.Key); problem != "" {
		return removedImage{Key: u.Key, Message: problem}, nil
	}
	return removedImage{Key: u.Key, Deleted: true}, nil
}
