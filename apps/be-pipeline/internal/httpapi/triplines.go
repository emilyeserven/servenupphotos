package httpapi

import (
	"context"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handleSaveTripLine saves the body as the path's day's trip line, new or
// replacing the one there, as a change waiting for Commit.
func handleSaveTripLine(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var line github.TripLine
		if !decodeEntry(w, r, &line, "trip line") {
			return
		}
		line.ID = r.PathValue("day")
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.SaveTripLine(ctx, cfg, line)
		writeSocialResult(w, result, err, "could not save the trip line")
	}
}

// handleDeleteTripLine removes the path's day's trip line as a change waiting
// for Commit.
func handleDeleteTripLine(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.DeleteTripLine(ctx, cfg, r.PathValue("day"))
		writeSocialResult(w, result, err, "could not remove the trip line")
	}
}

// handleAutoTripLine answers the path's day's automatic trip line, as the
// next Commit would draw it, for the pipeline to preview.
func handleAutoTripLine(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.AutoTripLine(ctx, cfg, r.PathValue("day"))
		writeSocialResult(w, result, err, "could not work out the automatic trip line")
	}
}
