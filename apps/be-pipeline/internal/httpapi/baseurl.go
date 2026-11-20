package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// baseURLTimeout bounds a base URL preview or change, which reads every photo
// JSON file from GitHub.
const baseURLTimeout = 60 * time.Second

type baseURLRequest struct {
	// From is the base URL the image URLs start with now.
	From string `json:"from"`
	// To is the base URL they should start with instead.
	To string `json:"to"`
}

// handlePreviewBaseURL reports the origins of the image URLs in every photo
// JSON file and which of them changing the base URL in the body would rewrite,
// as the Update Data page previews a change.
func handlePreviewBaseURL(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return handleBaseURL(store, func(ctx context.Context, cfg settings.GitHub, req baseURLRequest) (any, error) {
		return gh.PreviewBaseURL(ctx, cfg, req.From, req.To)
	})
}

// handleReplaceBaseURL rewrites the image URLs in every photo JSON file from
// one base URL to another, as one commit in the photo data pull request.
func handleReplaceBaseURL(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return handleBaseURL(store, func(ctx context.Context, cfg settings.GitHub, req baseURLRequest) (any, error) {
		return gh.ReplaceBaseURL(ctx, cfg, req.From, req.To)
	})
}

func handleBaseURL(store *settings.Store, run func(context.Context, settings.GitHub, baseURLRequest) (any, error)) http.HandlerFunc {
	return withGitHubBody(store, baseURLTimeout, "base URLs", "Couldn't change the image base URL.",
		func(ctx context.Context, _ *http.Request, cfg settings.GitHub, req baseURLRequest) (any, error) {
			return run(ctx, cfg, req)
		})
}
