package httpapi

import (
	"context"
	"net/http"
	"strconv"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handleChangelog answers one page of the Changelog: the commits on the base
// branch of the GitHub repository from Settings, newest first, without merge
// commits. The page is the "page" query parameter, from 1.
func handleChangelog(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, publishTimeout, "Couldn't read the Changelog.", func(ctx context.Context, r *http.Request, cfg settings.GitHub) (any, error) {
		page, err := strconv.Atoi(r.URL.Query().Get("page"))
		if err != nil || page < 1 {
			page = 1
		}
		return gh.Changelog(ctx, cfg, page)
	})
}
