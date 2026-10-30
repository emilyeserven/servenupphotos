package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handleDiscardPending drops the changes waiting for Commit to the body's
// "paths", or all of them when it lists none, without touching GitHub or R2.
func handleDiscardPending(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Paths []string `json:"paths"`
		}
		if r.ContentLength != 0 {
			if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxEditsBody)).Decode(&body); err != nil {
				writeError(w, http.StatusBadRequest, "The changes to discard couldn't be read.")
				return
			}
		}
		cfg, err := store.GitHub()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}
		result, err := gh.Discard(cfg, body.Paths)
		var perr *github.PublishError
		if errors.As(err, &perr) {
			writePublishError(w, perr)
			return
		}
		if err != nil {
			slog.Error("discard pending changes failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not discard the pending changes")
			return
		}
		writeJSON(w, http.StatusOK, result)
	}
}

// maxBackupBody bounds an in-flight backup loaded back in.
const maxBackupBody = 32 << 20

// handleExportPending answers every change waiting for Commit as an in-flight
// backup, reading nothing from GitHub, so it works offline.
func handleExportPending(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		cfg, err := store.GitHub()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}
		backup, err := gh.Backup(cfg)
		writeGitHubResult(w, backup, err, "could not read the pending changes")
	}
}

// handleImportPending keeps the files in an in-flight backup, the body, as
// changes waiting for Commit. A backup of another repository, or of a newer
// version than this backend reads, is refused.
func handleImportPending(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var backup github.InFlightBackup
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBackupBody)).Decode(&backup); err != nil {
			writeError(w, http.StatusBadRequest, "The backup couldn't be read as JSON.")
			return
		}
		cfg, err := store.GitHub()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}
		if problem := backupProblem(backup, cfg); problem != "" {
			writeError(w, http.StatusBadRequest, problem)
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.Restore(ctx, cfg, backup.Files)
		writeGitHubResult(w, result, err, "could not restore the pending changes")
	}
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

// writeGitHubResult answers result, or err as GitHub's error or failed.
func writeGitHubResult(w http.ResponseWriter, result any, err error, failed string) {
	var perr *github.PublishError
	if errors.As(err, &perr) {
		writePublishError(w, perr)
		return
	}
	if err != nil {
		slog.Error(failed, "err", err)
		writeError(w, http.StatusInternalServerError, failed)
		return
	}
	writeJSON(w, http.StatusOK, result)
}
