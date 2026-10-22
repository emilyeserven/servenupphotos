package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handleCombineStatus reports the "Combine photo data" run that rebuilds
// ALLPHOTOS.json for the commit in the "sha" query parameter, or for the open
// "Add photo data" pull request's head when it is absent. Pages poll it to
// know when ALLPHOTOS.json is up to date.
func handleCombineStatus(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, err := store.GitHub()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		status, err := gh.Combine(ctx, cfg, r.URL.Query().Get("sha"))
		var perr *github.PublishError
		if errors.As(err, &perr) {
			writeError(w, perr.Status, perr.Message)
			return
		}
		if err != nil {
			slog.Error("read combine status failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read the workflow runs")
			return
		}
		writeJSON(w, http.StatusOK, status)
	}
}
