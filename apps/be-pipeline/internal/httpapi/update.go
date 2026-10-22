package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

type updateInFlightRequest struct {
	// Path is the photo JSON file's path in the repository.
	Path string `json:"path"`
	// Data is the file's new content, a JSON object.
	Data json.RawMessage `json:"data"`
}

// handleUpdateInFlight replaces the content of a photo JSON file in the open
// "Add photo data" pull request with the body's data, as the Photo page saves
// an edit of a photo in flight.
func handleUpdateInFlight(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req updateInFlightRequest
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxPhotoDataBytes)).Decode(&req); err != nil || req.Path == "" {
			writeError(w, http.StatusBadRequest, "path and data are required")
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
		updated, err := gh.Update(ctx, cfg, req.Path, req.Data)
		var perr *github.PublishError
		if errors.As(err, &perr) {
			writeError(w, perr.Status, perr.Message)
			return
		}
		if err != nil {
			slog.Error("update photo data failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not update photo data")
			return
		}
		writeJSON(w, http.StatusOK, updated)
	}
}
