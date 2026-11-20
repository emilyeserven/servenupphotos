package httpapi

import (
	"context"
	"net/http"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handleDiscardPending drops the changes waiting for Commit to the body's
// "paths", or all of them when it lists none, without touching GitHub or R2.
func handleDiscardPending(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return optionalBody(withGitHubBodyUpTo(store, publishTimeout, "changes to discard", maxEditsBody, "Couldn't discard the changes waiting for Commit.",
		func(_ context.Context, _ *http.Request, cfg settings.GitHub, body discardRequest) (any, error) {
			return gh.Discard(cfg, body.Paths)
		}))
}

// discardRequest is the body of a discard: the files whose changes to drop,
// or none for all of them.
type discardRequest struct {
	Paths []string `json:"paths"`
}

// maxBackupBody bounds an in-flight backup loaded back in.
const maxBackupBody = 32 << 20

// handleExportPending answers every change waiting for Commit as an in-flight
// backup, reading nothing from GitHub, so it works offline.
func handleExportPending(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, publishTimeout, "Couldn't read the changes waiting for Commit.", func(_ context.Context, _ *http.Request, cfg settings.GitHub) (any, error) {
		return gh.Backup(cfg)
	})
}

// handleImportPending keeps the files in an in-flight backup, the body, as
// changes waiting for Commit. A backup of another repository, or of a newer
// version than this backend reads, is refused.
func handleImportPending(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBodyUpTo(store, publishTimeout, "backup", maxBackupBody, "Couldn't restore the changes waiting for Commit.",
		func(ctx context.Context, _ *http.Request, cfg settings.GitHub, backup github.InFlightBackup) (any, error) {
			if problem := backupProblem(backup, cfg); problem != "" {
				return nil, badRequest(problem)
			}
			return gh.Restore(ctx, cfg, backup.Files)
		})
}

// backupProblem says why backup can't be loaded with the GitHub settings in
// cfg, or "" when it can.
func backupProblem(backup github.InFlightBackup, cfg settings.GitHub) string {
	if backup.Version < 1 || backup.Version > github.BackupVersion {
		return "This isn't an in-flight backup this pipeline can read."
	}
	if !strings.EqualFold(backup.Repo, strings.TrimSpace(cfg.Repo)) {
		return "This backup is of " + backup.Repo + ", but Settings use " + cfg.Repo + "."
	}
	return ""
}
