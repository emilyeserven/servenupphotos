package httpapi

import (
	"context"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

type socialDatesRequest struct {
	Dates []github.SocialDate `json:"dates"`
}

// handleSocialCalendar lists every photo JSON file with its social media
// publish date, for the Instagram page's calendar. It only reads from GitHub.
func handleSocialCalendar(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, baseURLTimeout, "Couldn't read the photo files.", func(ctx context.Context, _ *http.Request, cfg settings.GitHub) (any, error) {
		return gh.SocialCalendar(ctx, cfg)
	})
}

// handleAttention lists every photo JSON file cut down to the fields the
// Dashboard's Needs attention counts from. It only reads from GitHub.
func handleAttention(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, baseURLTimeout, "Couldn't read the photo files.", func(ctx context.Context, _ *http.Request, cfg settings.GitHub) (any, error) {
		return gh.Attention(ctx, cfg)
	})
}

// handleSetSocialDates sets the social media publish dates in the body, as
// one commit in the photo data pull request.
func handleSetSocialDates(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBody(store, baseURLTimeout, "publish dates", "Couldn't save the publish dates.",
		func(ctx context.Context, _ *http.Request, cfg settings.GitHub, req socialDatesRequest) (any, error) {
			return gh.SetSocialDates(ctx, cfg, req.Dates)
		})
}
