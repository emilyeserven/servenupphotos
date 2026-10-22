package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// maxPhotoDataBytes caps the size of a photo data body.
const maxPhotoDataBytes = 64 << 10

// publishTimeout bounds a publish, which makes several GitHub calls in a row.
const publishTimeout = 30 * time.Second

// handlePublishPhoto saves a photo's sanitized EXIF as JSON in a pull request
// on the GitHub repository from Settings.
func handlePublishPhoto(store *settings.Store, gh *github.Client) http.HandlerFunc {
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

		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.Publish(ctx, cfg, photo)
		var perr *github.PublishError
		if errors.As(err, &perr) {
			writeError(w, perr.Status, perr.Message)
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
			writeError(w, perr.Status, perr.Message)
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
