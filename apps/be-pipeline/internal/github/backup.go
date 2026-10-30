package github

import (
	"context"
	"encoding/json"
	"net/http"
	"path"
	"sort"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// BackupVersion is the version of the in-flight backup file this backend writes and reads.
const BackupVersion = 1

// InFlightBackup is the changes waiting for Commit for one repository, as a
// file the app can download and load again, or keep in the browser while the
// pipeline is offline.
type InFlightBackup struct {
	Version int    `json:"version"`
	Repo    string `json:"repo"`
	// Exported is when the backup was made.
	Exported time.Time    `json:"exported"`
	Files    []BackupFile `json:"files"`
}

// BackupFile is one data file waiting for Commit: its data as saved, or
// Deleted when the change removes it.
type BackupFile struct {
	Path    string          `json:"path"`
	Data    json.RawMessage `json:"data,omitempty"`
	Deleted bool            `json:"deleted,omitempty"`
	// Saved is when it was last saved.
	Saved time.Time `json:"saved"`
}

// RestoreResult says how many files a restore kept as changes waiting for
// Commit, and how many were already as the backup has them.
type RestoreResult struct {
	Restored  int `json:"restored"`
	Unchanged int `json:"unchanged"`
}

// Backup is every change waiting for Commit to gh's repository, sorted by
// path. It reads nothing from GitHub, so it works offline.
func (c *Client) Backup(gh settings.GitHub) (InFlightBackup, error) {
	owner, name, ok := splitRepo(gh.Repo)
	if !ok {
		return InFlightBackup{}, publishErr(http.StatusBadRequest, "Set the GitHub repository and token in Settings first.")
	}
	files, err := c.stage().files(target{owner: owner, name: name})
	if err != nil {
		return InFlightBackup{}, publishErr(http.StatusInternalServerError, "Couldn't read the pending changes: %v", err)
	}
	backup := InFlightBackup{Version: BackupVersion, Repo: owner + "/" + name, Exported: c.now().UTC(), Files: []BackupFile{}}
	for p, f := range files {
		backup.Files = append(backup.Files, backupFile(p, f))
	}
	sort.Slice(backup.Files, func(i, j int) bool { return backup.Files[i].Path < backup.Files[j].Path })
	return backup, nil
}

// backupFile is f, kept at p, as a backup has it.
func backupFile(p string, f StagedFile) BackupFile {
	out := BackupFile{Path: p, Deleted: f.Deleted, Saved: f.Saved}
	if !f.Deleted {
		out.Data = json.RawMessage(f.Content)
	}
	return out
}

// Restore keeps each of files as a change waiting for Commit, as a save would:
// formatted like the app formats data files, and dropped when the head
// already has it. A file that isn't a photo, album, tag or other data file in
// the data folder, or whose data isn't JSON, stops the restore before
// anything is kept, naming it.
func (c *Client) Restore(ctx context.Context, gh settings.GitHub, files []BackupFile) (RestoreResult, error) {
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return RestoreResult{}, perr
	}
	changes, perr := restoreChanges(w.root, files)
	if perr != nil {
		return RestoreResult{}, perr
	}
	if perr := c.save(w, changes); perr != nil {
		return RestoreResult{}, perr
	}
	result := RestoreResult{}
	for p := range changes {
		if _, ok := w.staged[p]; ok {
			result.Restored++
		} else {
			result.Unchanged++
		}
	}
	return result, nil
}

// restoreChanges is files as save takes them, by path, checked against the
// data folder at root.
func restoreChanges(root string, files []BackupFile) (map[string][]byte, *PublishError) {
	changes := map[string][]byte{}
	for _, f := range files {
		if path.Clean(f.Path) != f.Path || dataKind(root, f.Path) == "" {
			return nil, publishErr(http.StatusBadRequest, "%s isn't a data file in %s, so nothing was restored.", f.Path, root)
		}
		if f.Deleted {
			changes[f.Path] = nil
			continue
		}
		if !json.Valid(f.Data) || len(f.Data) == 0 {
			return nil, publishErr(http.StatusBadRequest, "%s doesn't have valid JSON data, so nothing was restored.", f.Path)
		}
		changes[f.Path] = formatJSONFile(f.Data)
	}
	return changes, nil
}
