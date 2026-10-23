package github

import (
	"context"
	"encoding/json"
	"net/http"
	"path"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// Combined sync states.
const (
	// CombinedSynced means the combined lists at the photo data pull
	// request's head have every change: nothing is pending.
	CombinedSynced = "synced"
	// CombinedStale means there are changes the combined lists don't have:
	// pending ones, or ones committed to the pull request without rebuilding
	// them.
	CombinedStale = "stale"
	// CombinedNoPullRequest means no pull request titled PullRequestTitle is
	// open and nothing is pending, so nothing is in flight.
	CombinedNoPullRequest = "none"
)

// Pending changes, as the sync button counts them.
const (
	PendingAdded    = "added"
	PendingModified = "modified"
	PendingDeleted  = "deleted"
)

// CombinedStatus is whether the combined lists have every change in flight.
type CombinedStatus struct {
	State string `json:"state"`
	// HeadSHA is the pull request's head; empty with no pull request.
	HeadSHA string `json:"headSha,omitempty"`
	// Pending are the data files the combined lists at the head don't have
	// yet: the pending changes, and files committed to the pull request
	// without rebuilding them.
	Pending []PendingFile `json:"pending,omitempty"`
	// Changes are the pending changes, before (as the head has them) and
	// after, so the app can show them in the combined lists.
	Changes []PendingChange `json:"changes,omitempty"`
}

// PendingFile is a data file the combined lists don't have yet.
type PendingFile struct {
	// Kind is the combined list it goes in: photos, albums, tags, places or
	// localizations.
	Kind string `json:"kind"`
	Path string `json:"path"`
	// Change is PendingAdded, PendingModified or PendingDeleted.
	Change string `json:"change"`
}

// PendingChange is one pending change to a data file: its data at the head
// (null when it isn't there) and as saved (null when removed).
type PendingChange struct {
	Kind   string          `json:"kind"`
	Path   string          `json:"path"`
	Before json.RawMessage `json:"before"`
	After  json.RawMessage `json:"after"`
}

// CombinedStatus reports what the combined lists at the head don't have yet:
// the pending changes, and data files committed without rebuilding them,
// found by comparing each list with the files it's built from. It reads
// nothing from GitHub that a recent read already has.
func (c *Client) CombinedStatus(ctx context.Context, gh settings.GitHub) (CombinedStatus, error) {
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return CombinedStatus{}, perr
	}
	status := CombinedStatus{State: CombinedSynced}
	if w.pr != nil {
		status.HeadSHA = w.pr.Head.SHA
	}
	pending := map[string]PendingFile{}
	// With no pull request open, the base branch's lists are the portfolio's, and Commit leaves them alone.
	for _, kind := range combinedKinds() {
		if w.pr != nil {
			w.unsyncedAtHead(kind, pending)
		}
	}
	w.addPending(pending, &status)
	for _, f := range pending {
		status.Pending = append(status.Pending, f)
	}
	sortPending(status.Pending)
	switch {
	case len(status.Pending) > 0:
		status.State = CombinedStale
	case w.pr == nil:
		status.State = CombinedNoPullRequest
	}
	return status, nil
}

// unsyncedAtHead adds to pending kind's files at the head that its combined
// list there doesn't have: a file whose data isn't one of its entries was
// added or modified (modified when an entry has its identity, its "file" or
// "id"), and an entry no file has the identity of was deleted.
func (w *workspace) unsyncedAtHead(kind combinedKind, pending map[string]PendingFile) {
	folder := w.root + "/" + kind.folder
	head := w.withChanges(nil)
	all := head.head.files[folder+"/"+kind.allFile]
	var entries []json.RawMessage
	_ = json.Unmarshal(all.content, &entries)
	inList, ids := map[string]bool{}, map[string]bool{}
	for _, e := range entries {
		inList[canonicalJSON(e)], ids[identity(kind, e)] = true, true
	}
	fileIDs := map[string]bool{}
	for _, p := range head.paths(folder, kind.allFile) {
		data, _ := head.json(p)
		id := identity(kind, data)
		fileIDs[id] = true
		if inList[canonicalJSON(data)] {
			continue
		}
		change := PendingAdded
		if ids[id] {
			change = PendingModified
		}
		pending[p] = PendingFile{Kind: kind.name, Path: p, Change: change}
	}
	for id := range ids {
		if !fileIDs[id] && id != "" {
			p := folder + "/" + id
			pending[p] = PendingFile{Kind: kind.name, Path: p, Change: PendingDeleted}
		}
	}
}

// identity is what entry, a data file's JSON, is told apart by: a photo's
// "file", or anything else's "id".
func identity(kind combinedKind, entry json.RawMessage) string {
	var fields struct {
		File string `json:"file"`
		ID   string `json:"id"`
	}
	_ = json.Unmarshal(entry, &fields)
	if kind.name == "photos" {
		return strings.TrimSpace(fields.File)
	}
	return strings.TrimSpace(fields.ID)
}

// addPending adds the pending changes to pending, each with how it changes
// the file since the combined lists were last rebuilt, and to status's
// Changes.
func (w *workspace) addPending(pending map[string]PendingFile, status *CombinedStatus) {
	for p, f := range w.staged {
		kind := dataKind(w.root, p)
		if kind == "" {
			continue
		}
		head, onHead := w.head.files[p]
		change := PendingChange{Kind: kind, Path: p, After: json.RawMessage(f.data())}
		if onHead {
			change.Before = json.RawMessage(head.content)
		}
		status.Changes = append(status.Changes, change)
		net := netPending(pending[p].Change, onHead, f.Deleted)
		if net == "" {
			delete(pending, p)
			continue
		}
		pending[p] = PendingFile{Kind: kind, Path: p, Change: net}
	}
}

// netPending is how a file changes since the combined lists were last rebuilt
// when it was already pending as before ("" when it wasn't) and a pending
// change, on a file the head has or not, deletes it or not. A file added and
// then deleted again hasn't changed.
func netPending(before string, onHead, deleted bool) string {
	switch {
	case deleted && (before == PendingAdded || !onHead):
		return ""
	case deleted:
		return PendingDeleted
	case before == PendingAdded || !onHead:
		return PendingAdded
	}
	return PendingModified
}

// sortPending sorts files by path.
func sortPending(files []PendingFile) {
	paths := make([]string, len(files))
	byPath := map[string]PendingFile{}
	for i, f := range files {
		paths[i], byPath[f.Path] = f.Path, f
	}
	sortPaths(paths)
	for i, p := range paths {
		files[i] = byPath[p]
	}
}

// dataKind is the combined list the data file at file goes in, or "" when it
// isn't a data file, such as a combined list.
func dataKind(root, file string) string {
	for _, k := range combinedKinds() {
		if isDataFile(root+"/"+k.folder, file, k.allFile) {
			return k.name
		}
	}
	return ""
}

// DiscardResult says how many pending changes Discard dropped.
type DiscardResult struct {
	Discarded int `json:"discarded"`
}

// Discard drops the pending changes to paths, or every pending change when
// paths is empty, without touching GitHub or R2.
func (c *Client) Discard(gh settings.GitHub, paths []string) (DiscardResult, error) {
	owner, name, ok := splitRepo(gh.Repo)
	if !ok {
		return DiscardResult{}, publishErr(http.StatusBadRequest, "Set the GitHub repository and token in Settings first.")
	}
	t := target{owner: owner, name: name}
	result := DiscardResult{}
	err := c.stage().update(t, func(files map[string]StagedFile) {
		for p := range files {
			if len(paths) == 0 || containsPath(paths, p) {
				delete(files, p)
				result.Discarded++
			}
		}
	})
	if err != nil {
		return DiscardResult{}, publishErr(http.StatusInternalServerError, "Couldn't drop the pending changes: %v", err)
	}
	return result, nil
}

func containsPath(paths []string, p string) bool {
	for _, q := range paths {
		if path.Clean(q) == p {
			return true
		}
	}
	return false
}

// Forget drops what's cached of where gh's repository stands, so the next
// read asks GitHub, as after a merge on GitHub. Snapshots are kept, since a
// commit never changes.
func (c *Client) Forget(gh settings.GitHub) {
	r := c.reads()
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.states, stateKey(gh))
}
