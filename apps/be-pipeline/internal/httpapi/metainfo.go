package httpapi

import (
	"context"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handleSaveMetaGroup saves the body as the path's metadata group, new or
// replacing the one there, as a change waiting for Commit.
func handleSaveMetaGroup(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var group github.MetaGroup
		if !decodeEntry(w, r, &group, "metadata group") {
			return
		}
		group.ID = r.PathValue("id")
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.SaveMetaGroup(ctx, cfg, group)
		writeSocialResult(w, result, err, "could not save the metadata group")
	}
}

// handleDeleteMetaGroup removes the path's metadata group as a change waiting
// for Commit.
func handleDeleteMetaGroup(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.DeleteMetaGroup(ctx, cfg, r.PathValue("id"))
		writeSocialResult(w, result, err, "could not remove the metadata group")
	}
}
