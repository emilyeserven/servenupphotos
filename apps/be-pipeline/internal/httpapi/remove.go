package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/versions"
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
	// Versions are what happened to the image's resized WEBP versions, which
	// are deleted along with it.
	Versions []removedImage `json:"versions,omitempty"`
}

type removeResponse struct {
	Path string `json:"path"`
	// CommitSHA is the commit that removed the file, whose CI run rebuilds
	// ALLPHOTOS.json; see handleCombineStatus.
	CommitSHA string       `json:"commitSha"`
	Image     removedImage `json:"image"`
}

// handleRemoveInFlight deletes the photo JSON at the "path" query parameter
// from the open "Add photo data" pull request, then deletes its image from
// R2, with all of its resized versions. Once the JSON is gone it responds 200 even if the image couldn't be
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
		writeJSON(w, http.StatusOK, removeResponse{Path: removed.Path, CommitSHA: removed.CommitSHA, Image: image})
	}
}

// removeImage deletes removed's image from the R2 bucket from Settings, the
// same image the Photos in Flight page shows for it, and its resized versions.
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
	image := deleteImage(ctx, cfg, deletePhoto, u.Key)
	for _, v := range versions.Published() {
		image.Versions = append(image.Versions, deleteImage(ctx, cfg, deletePhoto, storage.VersionKey(u.Key, v.Name)))
	}
	return image, nil
}

// deleteImage deletes key from R2 and says how that went.
func deleteImage(ctx context.Context, cfg settings.R2, deletePhoto deletePhotoFunc, key string) removedImage {
	if problem := deletePhoto(ctx, cfg, key); problem != "" {
		return removedImage{Key: key, Message: problem}
	}
	return removedImage{Key: key, Deleted: true}
}
