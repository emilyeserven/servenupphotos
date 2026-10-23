package httpapi

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handleDiscardPending drops the changes waiting for Commit to the body's
// "paths", or all of them when it lists none, without touching GitHub or R2.
func handleDiscardPending(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Paths []string `json:"paths"`
		}
		if r.ContentLength != 0 {
			if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxEditsBody)).Decode(&body); err != nil {
				writeError(w, http.StatusBadRequest, "The changes to discard couldn't be read.")
				return
			}
		}
		cfg, err := store.GitHub()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}
		result, err := gh.Discard(cfg, body.Paths)
		var perr *github.PublishError
		if errors.As(err, &perr) {
			writeError(w, perr.Status, perr.Message)
			return
		}
		if err != nil {
			slog.Error("discard pending changes failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not discard the pending changes")
			return
		}
		writeJSON(w, http.StatusOK, result)
	}
}
