package httpapi

import (
	"context"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handleSaveTimelineLabel saves the body as the path's timeline label, new or
// replacing the one there, as a change waiting for Commit.
func handleSaveTimelineLabel(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var label github.TimelineLabel
		if !decodeEntry(w, r, &label, "timeline label") {
			return
		}
		label.ID = r.PathValue("id")
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.SaveTimelineLabel(ctx, cfg, label)
		writeSocialResult(w, result, err, "could not save the timeline label")
	}
}

// handleDeleteTimelineLabel removes the path's timeline label as a change
// waiting for Commit.
func handleDeleteTimelineLabel(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.DeleteTimelineLabel(ctx, cfg, r.PathValue("id"))
		writeSocialResult(w, result, err, "could not remove the timeline label")
	}
}
