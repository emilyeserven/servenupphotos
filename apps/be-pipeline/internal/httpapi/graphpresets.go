package httpapi

import (
	"context"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handleSaveGraphPreset saves the body as the path's graph preset or preset
// group, new or replacing the one there, as a change waiting for Commit.
func handleSaveGraphPreset(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var preset github.GraphPreset
		if !decodeEntry(w, r, &preset, "graph preset") {
			return
		}
		preset.ID = r.PathValue("id")
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.SaveGraphPreset(ctx, cfg, preset)
		writeSocialResult(w, result, err, "could not save the graph preset")
	}
}

// handleDeleteGraphPreset removes the path's graph preset or preset group as
// a change waiting for Commit.
func handleDeleteGraphPreset(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.DeleteGraphPreset(ctx, cfg, r.PathValue("id"))
		writeSocialResult(w, result, err, "could not remove the graph preset")
	}
}
