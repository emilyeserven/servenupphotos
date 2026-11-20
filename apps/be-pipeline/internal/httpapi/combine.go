package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// commitCombinedTimeout bounds rebuilding the combined lists, which reads every
// photo, album and tag JSON file from GitHub.
const commitCombinedTimeout = 60 * time.Second

// handleCombinedStatus reports whether ALLPHOTOS.json, ALLALBUMS.json and
// ALLTAGS.json on the open "Add photo data" pull request have its latest
// changes. Pages check it once, when the app starts.
func handleCombinedStatus(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, publishTimeout, "Couldn't read the branch's commits.",
		func(ctx context.Context, _ *http.Request, cfg settings.GitHub) (any, error) {
			return gh.CombinedStatus(ctx, cfg)
		})
}

// commitCombinedRequest is the body of a Commit: field edits to make first.
type commitCombinedRequest struct {
	Edits []github.FieldEdit `json:"edits"`
}

// handleCommitCombined applies the edits in the request body, if any, to the
// data files on the open "Add photo data" pull request, rebuilds
// ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json from them and commits the
// files that changed as one commit to its branch.
func handleCommitCombined(store *settings.Store, gh *github.Client) http.HandlerFunc {
	// A Commit without edits sends no body.
	return optionalBody(withGitHubBodyUpTo(store, commitCombinedTimeout, "edits to commit", maxEditsBody, "Couldn't commit the combined files.",
		func(ctx context.Context, _ *http.Request, cfg settings.GitHub, body commitCombinedRequest) (any, error) {
			return gh.CommitCombined(ctx, cfg, body.Edits)
		}))
}

// maxEditsBody bounds the edits a commit takes, which are a few fields per
// photo file.
const maxEditsBody = 4 << 20
