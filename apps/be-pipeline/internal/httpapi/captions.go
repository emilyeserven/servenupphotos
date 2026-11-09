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
	return withGitHubBody(store, publishTimeout, "caption template", "could not save the caption template",
		func(ctx context.Context, r *http.Request, cfg settings.GitHub, template github.CaptionTemplate) (any, error) {
			template.ID = r.PathValue("id")
			return gh.SaveCaptionTemplate(ctx, cfg, template)
		})
}

// handleDeleteCaptionTemplate removes the path's caption template as a
// change waiting for Commit.
func handleDeleteCaptionTemplate(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, publishTimeout, "could not remove the caption template", func(ctx context.Context, r *http.Request, cfg settings.GitHub) (any, error) {
		return gh.DeleteCaptionTemplate(ctx, cfg, r.PathValue("id"))
	})
}
