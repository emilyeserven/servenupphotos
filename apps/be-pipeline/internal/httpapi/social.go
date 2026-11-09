package httpapi

import (
	"context"
	"encoding/json"
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
	return withGitHub(store, baseURLTimeout, "could not read the photo files", func(ctx context.Context, _ *http.Request, cfg settings.GitHub) (any, error) {
		return gh.SocialCalendar(ctx, cfg)
	})
}

// handleAttention lists every photo JSON file cut down to the fields the
// Dashboard's Needs attention counts from. It only reads from GitHub.
func handleAttention(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, baseURLTimeout, "could not read the photo files", func(ctx context.Context, _ *http.Request, cfg settings.GitHub) (any, error) {
		return gh.Attention(ctx, cfg)
	})
}

// handleSetSocialDates sets the social media publish dates in the body, as
// one commit in the photo data pull request.
func handleSetSocialDates(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req socialDatesRequest
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxPhotoDataBytes)).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid publish dates body")
			return
		}
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), baseURLTimeout)
		defer cancel()
		result, err := gh.SetSocialDates(ctx, cfg, req.Dates)
		writeResult(w, result, err, "could not save the publish dates")
	}
}
