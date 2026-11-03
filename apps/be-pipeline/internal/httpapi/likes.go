package httpapi

import (
	"context"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handleSaveViewerLikes saves the body as the path's viewer likes, replacing the
// list that person sent before, as a change waiting for Commit.
func handleSaveViewerLikes(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var viewer github.ViewerLikes
		if !decodeEntry(w, r, &viewer, "viewer likes") {
			return
		}
		viewer.ID = r.PathValue("id")
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.SaveViewerLikes(ctx, cfg, viewer)
		writeSocialResult(w, result, err, "could not save the viewer's likes")
	}
}

// handleDeleteViewerLikes removes the path's viewer likes as a change waiting for
// Commit.
func handleDeleteViewerLikes(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.DeleteViewerLikes(ctx, cfg, r.PathValue("id"))
		writeSocialResult(w, result, err, "could not remove the viewer's likes")
	}
}
