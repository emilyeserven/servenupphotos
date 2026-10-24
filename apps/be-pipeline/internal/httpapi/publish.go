package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/colors"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// maxPhotoDataBytes caps the size of a photo data body.
const maxPhotoDataBytes = 64 << 10

// publishTimeout bounds a publish, which makes several GitHub calls in a row.
const publishTimeout = 30 * time.Second

// publishColorsTimeout bounds reading a photo's colors before a publish,
// which downloads its original from R2 unless its upload just read them.
const publishColorsTimeout = 20 * time.Second

// handlePublishPhoto saves a photo's sanitized EXIF as JSON in a pull request
// on the GitHub repository from Settings, with its colors read from its
// original in R2 by readColors when it's there.
func handlePublishPhoto(store *settings.Store, gh *github.Client, readColors github.ColorReader) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var photo github.Photo
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxPhotoDataBytes))
		dec.DisallowUnknownFields()
		if err := dec.Decode(&photo); err != nil {
			writeError(w, http.StatusBadRequest, "invalid photo data body")
			return
		}
		cfg, err := store.GitHub()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}

		photo.Colors = photoColors(r.Context(), readColors, photo.Sanitized.Images.Key)
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.Publish(ctx, cfg, photo)
		var perr *github.PublishError
		if errors.As(err, &perr) {
			writePublishError(w, perr)
			return
		}
		if err != nil {
			slog.Error("publish photo failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not publish photo data")
			return
		}
		writeJSON(w, http.StatusOK, result)
	}
}

// photoColors reads the colors of the original at key, or nil when there's no
// key or they can't be read, so the photo is saved without them; Update
// Data's Colors can add them later.
func photoColors(ctx context.Context, readColors github.ColorReader, key *string) *colors.Analysis {
	if key == nil || *key == "" {
		return nil
	}
	ctx, cancel := context.WithTimeout(ctx, publishColorsTimeout)
	defer cancel()
	analysis, msg := readColors(ctx, *key)
	if msg != "" {
		slog.Warn("could not read the photo's colors", "key", *key, "reason", msg)
		return nil
	}
	return &analysis
}

// handleAllPhotosCheck looks for the photo in the body, identified by its file
// name, GPS position and creation date, in ALLPHOTOS.json on GitHub, so a
// photo already in the portfolio isn't uploaded or saved again.
func handleAllPhotosCheck(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var photo github.PhotoIdentity
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxPhotoDataBytes)).Decode(&photo); err != nil {
			writeError(w, http.StatusBadRequest, "invalid photo body")
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
		result, err := gh.FindInPullRequest(ctx, cfg, photo)
		var perr *github.PublishError
		if errors.As(err, &perr) {
			writePublishError(w, perr)
			return
		}
		if err != nil {
			slog.Error("check ALLPHOTOS.json failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not check ALLPHOTOS.json")
			return
		}
		writeJSON(w, http.StatusOK, result)
	}
}
