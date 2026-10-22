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
// "Add photo data" pull request's head when it is absent. Pages check the head
// when they start, and poll a commit's run after starting it with
// handleRebuild, to know when ALLPHOTOS.json is up to date.
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
		writeCombineStatus(w, status, err, "read combine status failed", "could not read the workflow runs")
	}
}

// handleRebuild starts the "Combine photo data" run that rebuilds
// ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json on the open "Add photo data"
// pull request, and responds with it as waiting at the pull request's head.
func handleRebuild(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, err := store.GitHub()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		status, err := gh.Rebuild(ctx, cfg)
		writeCombineStatus(w, status, err, "start rebuild failed", "could not start the rebuild")
	}
}

// writeCombineStatus responds with status, or with err as a PublishError's
// message or else as failed.
func writeCombineStatus(w http.ResponseWriter, status github.CombineStatus, err error, logMsg, failed string) {
	var perr *github.PublishError
	if errors.As(err, &perr) {
		writeError(w, perr.Status, perr.Message)
		return
	}
	if err != nil {
		slog.Error(logMsg, "err", err)
		writeError(w, http.StatusInternalServerError, failed)
		return
	}
	writeJSON(w, http.StatusOK, status)
}
