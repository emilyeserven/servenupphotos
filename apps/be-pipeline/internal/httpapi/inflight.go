package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handlePhotosInFlight lists the photo JSON in the open "Add photo data" pull
// request on the GitHub repository from Settings, without changing anything.
func handlePhotosInFlight(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, err := store.GitHub()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.InFlight(ctx, cfg)
		var perr *github.PublishError
		if errors.As(err, &perr) {
			writeError(w, perr.Status, perr.Message)
			return
		}
		if err != nil {
			slog.Error("read photos in flight failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read photos in flight")
			return
		}
		writeJSON(w, http.StatusOK, result)
	}
}
