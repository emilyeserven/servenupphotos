package httpapi

import (
	"context"
	"errors"
	"log/slog"
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
	return handleCombinedAction(store, publishTimeout, "read combined status failed", "could not read the branch's commits",
		func(ctx context.Context, cfg settings.GitHub) (any, error) { return gh.CombinedStatus(ctx, cfg) })
}

// handleCommitCombined rebuilds ALLPHOTOS.json, ALLALBUMS.json and
// ALLTAGS.json from the data files on the open "Add photo data" pull request
// and commits the ones that changed as one commit to its branch.
func handleCommitCombined(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return handleCombinedAction(store, commitCombinedTimeout, "commit combined failed", "could not commit the combined files",
		func(ctx context.Context, cfg settings.GitHub) (any, error) { return gh.CommitCombined(ctx, cfg) })
}

// handleCombinedAction runs do with the GitHub settings and responds with its
// result, or with its error as a PublishError's message or else as failed.
func handleCombinedAction(store *settings.Store, timeout time.Duration, logMsg, failed string,
	do func(context.Context, settings.GitHub) (any, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, err := store.GitHub()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), timeout)
		defer cancel()
		result, err := do(ctx, cfg)
		var perr *github.PublishError
		if errors.As(err, &perr) {
			writeError(w, perr.Status, perr.Message)
			return
		}
		if err != nil {
			slog.Error(logMsg, "err", err)
			writeError(w, http.StatusInternalServerError, failed)
			return
		}
		writeJSON(w, http.StatusOK, result)
	}
}
