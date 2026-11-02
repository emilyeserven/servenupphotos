package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// imageNamesTimeout bounds naming the images after their titles, which lists
// the bucket, reads every photo JSON file from GitHub and copies each renamed
// photo's original and versions in R2.
const imageNamesTimeout = 5 * time.Minute

// copyPhotoFunc copies a photo and its versions to another name in R2;
// storage.CopyPhoto in production.
type copyPhotoFunc func(ctx context.Context, cfg settings.R2, from, to string) string

// handlePreviewImageNames lists the photos whose images would be renamed
// after their titles in R2, as the Update Data page previews it.
func handlePreviewImageNames(store *settings.Store, gh *github.Client, list listImagesFunc) http.HandlerFunc {
	return handleImageNames(store, list, func(ctx context.Context, cfg settings.GitHub, _ settings.R2, keys []string) (any, error) {
		return gh.PreviewImageNames(ctx, cfg, keys)
	})
}

// handleRenameImages copies those photos' images to their new names in R2
// and saves their JSON with the new links, as changes waiting for Commit.
func handleRenameImages(store *settings.Store, gh *github.Client, list listImagesFunc, copyPhoto copyPhotoFunc) http.HandlerFunc {
	return handleImageNames(store, list, func(ctx context.Context, cfg settings.GitHub, r2 settings.R2, keys []string) (any, error) {
		return gh.RenameImages(ctx, cfg, keys, func(ctx context.Context, from, to string) string {
			return copyPhoto(ctx, r2, from, to)
		})
	})
}

func handleImageNames(
	store *settings.Store, list listImagesFunc,
	run func(context.Context, settings.GitHub, settings.R2, []string) (any, error),
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, err := store.GitHub()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}
		r2, err := store.R2()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), imageNamesTimeout)
		defer cancel()
		keys, status, msg := bucketKeys(ctx, r2, list)
		if status != http.StatusOK {
			writeError(w, status, msg)
			return
		}
		result, err := run(ctx, cfg, r2, keys)
		var perr *github.PublishError
		if errors.As(err, &perr) {
			writePublishError(w, perr)
			return
		}
		if err != nil {
			slog.Error("rename images failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not rename the images")
			return
		}
		writeJSON(w, http.StatusOK, result)
	}
}

// bucketKeys lists every image's key in the bucket, so new names don't take
// one another photo already has there, or says why it couldn't.
func bucketKeys(ctx context.Context, cfg settings.R2, list listImagesFunc) ([]string, int, string) {
	images, err := list(ctx, cfg)
	var lerr *storage.ListError
	if errors.As(err, &lerr) {
		if lerr.NotConfigured {
			return nil, http.StatusBadRequest, lerr.Message
		}
		return nil, http.StatusBadGateway, "Couldn't list the bucket. " + lerr.Message
	}
	if err != nil {
		slog.Error("list bucket failed", "err", err)
		return nil, http.StatusInternalServerError, "could not list the bucket"
	}
	keys := make([]string, 0, len(images))
	for _, img := range images {
		keys = append(keys, img.Key)
	}
	return keys, http.StatusOK, ""
}
