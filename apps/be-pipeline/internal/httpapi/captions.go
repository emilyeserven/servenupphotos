package httpapi

import (
	"context"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handleSaveCaptionTemplate saves the body as the path's caption template,
// new or replacing the one there, as a change waiting for Commit.
func handleSaveCaptionTemplate(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var template github.CaptionTemplate
		if !decodeEntry(w, r, &template, "caption template") {
			return
		}
		template.ID = r.PathValue("id")
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.SaveCaptionTemplate(ctx, cfg, template)
		writeSocialResult(w, result, err, "could not save the caption template")
	}
}

// handleDeleteCaptionTemplate removes the path's caption template as a
// change waiting for Commit.
func handleDeleteCaptionTemplate(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.DeleteCaptionTemplate(ctx, cfg, r.PathValue("id"))
		writeSocialResult(w, result, err, "could not remove the caption template")
	}
}
