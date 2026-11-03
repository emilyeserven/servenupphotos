package httpapi

import (
	"context"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handleSaveFanLikes saves the body as the path's fan likes, replacing the
// list that person sent before, as a change waiting for Commit.
func handleSaveFanLikes(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var fan github.FanLikes
		if !decodeEntry(w, r, &fan, "fan likes") {
			return
		}
		fan.ID = r.PathValue("id")
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.SaveFanLikes(ctx, cfg, fan)
		writeSocialResult(w, result, err, "could not save the fan's likes")
	}
}

// handleDeleteFanLikes removes the path's fan likes as a change waiting for
// Commit.
func handleDeleteFanLikes(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.DeleteFanLikes(ctx, cfg, r.PathValue("id"))
		writeSocialResult(w, result, err, "could not remove the fan's likes")
	}
}
