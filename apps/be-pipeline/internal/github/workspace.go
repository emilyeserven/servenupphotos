package github

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"path"
	"sort"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// workspace is the photo data as the next Commit will commit it: the files at
// the open photo data pull request's head, or at the base branch's when none
// is open, with the pending changes (Stage) made over them. Every page reads
// it, and every save changes its pending changes instead of committing, so
// reading it costs at most one GitHub call per new commit (see snapshot).
//
// Frontend analogy: it's TanStack Query's cache with optimistic updates on
// top: the server data (the snapshots) is fetched once and reused, and the
// local edits are layered over it until they're saved for real.
type workspace struct {
	repoState
	root string
	// base is the base branch's head, what the portfolio has.
	base *snapshot
	// head is the pull request's head, or base when none is open.
	head   *snapshot
	staged map[string]StagedFile
}

// workspace reads gh's workspace, from cached reads where they're recent
// enough.
func (c *Client) workspace(ctx context.Context, gh settings.GitHub) (*workspace, *PublishError) {
	return c.openWorkspace(ctx, gh, false)
}

// openWorkspace reads gh's workspace; fresh asks GitHub where the repository
// stands even when a recent answer is cached.
func (c *Client) openWorkspace(ctx context.Context, gh settings.GitHub, fresh bool) (*workspace, *PublishError) {
	root, perr := dataFolder(gh.Folder)
	if perr != nil {
		return nil, perr
	}
	s, perr := c.state(ctx, gh, fresh)
	if perr != nil {
		return nil, perr
	}
	w := &workspace{repoState: s, root: root}
	if w.base, perr = c.snapshot(ctx, s.t, root, s.baseHead); perr != nil {
		return nil, perr
	}
	w.head = w.base
	if s.pr != nil {
		if w.head, perr = c.snapshot(ctx, s.t, root, s.pr.Head.SHA); perr != nil {
			return nil, perr
		}
	}
	staged, err := c.stage().files(s.t)
	if err != nil {
		return nil, publishErr(http.StatusInternalServerError, "Couldn't read the pending changes: %v", err)
	}
	w.staged = staged
	return w, nil
}

// branch is where the next Commit commits: the pull request's branch, or the
// base branch when none is open (Commit then starts a new one from it).
func (w *workspace) branch() string {
	if w.pr != nil {
		return w.pr.Head.Ref
	}
	return w.t.base
}

// file is p's content as the next Commit will have it, and false when it
// won't be there.
func (w *workspace) file(p string) ([]byte, bool) {
	if f, ok := w.staged[p]; ok {
		return f.data(), !f.Deleted
	}
	f, ok := w.head.files[p]
	return f.content, ok
}

// readErr says why p, a file at the head, couldn't be read, or "".
func (w *workspace) readErr(p string) string {
	if _, ok := w.staged[p]; ok {
		return ""
	}
	return w.head.files[p].err
}

// onBase reports whether p is on the base branch, so it's already in the
// portfolio.
func (w *workspace) onBase(p string) bool {
	_, ok := w.base.files[p]
	return ok
}

// isPending reports whether p has a change that isn't committed yet.
func (w *workspace) isPending(p string) bool {
	_, ok := w.staged[p]
	return ok
}

// fileURL is p's page on GitHub at the branch, or "" when its latest content
// isn't committed yet.
func (w *workspace) fileURL(p string) string {
	if _, ok := w.head.files[p]; !ok || w.isPending(p) {
		return ""
	}
	return blobURL(w.t, w.branch(), p)
}

// blobURL is p's page on GitHub on branch.
func blobURL(t target, branch, p string) string {
	return "https://github.com/" + t.repo.FullName + "/blob/" + escapePath(branch) + "/" + escapePath(p)
}

// paths lists the .json files directly in folder as the next Commit will
// have them, except skip (a combined list), sorted by path as `LC_ALL=C sort`
// sorts them.
func (w *workspace) paths(folder, skip string) []string {
	seen := map[string]bool{}
	var out []string
	add := func(p string) {
		if seen[p] || !isDataFile(folder, p, skip) {
			return
		}
		seen[p] = true
		if _, ok := w.file(p); ok {
			out = append(out, p)
		}
	}
	for p := range w.head.files {
		add(p)
	}
	for p := range w.staged {
		add(p)
	}
	sortPaths(out)
	return out
}

// sortPaths sorts paths as `LC_ALL=C sort` does.
func sortPaths(paths []string) {
	sort.Strings(paths)
}

// isDataFile reports a .json file directly in folder other than skip.
func isDataFile(folder, p, skip string) bool {
	return inFolder(folder, p) && strings.EqualFold(path.Ext(p), ".json") && !strings.EqualFold(path.Base(p), skip)
}

// Change statuses of a file against the base branch, as GitHub names them in
// a pull request.
const (
	statusAdded    = "added"
	statusModified = "modified"
	statusRemoved  = "removed"
)

// status is how the next Commit's files change p against the base branch:
// statusAdded, statusModified or statusRemoved, or "" when they don't.
func (w *workspace) status(p string) string {
	now, there := w.file(p)
	was, wasThere := w.base.files[p]
	switch {
	case there && !wasThere:
		return statusAdded
	case !there && wasThere:
		return statusRemoved
	case there && !bytes.Equal(now, was.content):
		return statusModified
	}
	return ""
}

// changed lists the files directly in folder, except skip, that the next
// Commit's files change against the base branch, by path.
func (w *workspace) changed(folder, skip string) []string {
	seen := map[string]bool{}
	var out []string
	for _, files := range []map[string]snapFile{w.base.files, w.head.files} {
		for p := range files {
			seen[p] = true
		}
	}
	for p := range w.staged {
		seen[p] = true
	}
	for p := range seen {
		if isDataFile(folder, p, skip) && w.status(p) != "" {
			out = append(out, p)
		}
	}
	sortPaths(out)
	return out
}

// save keeps changes (nil content deletes a file) as pending changes for the
// next Commit. A file saved back to what the head has is no longer pending.
func (c *Client) save(w *workspace, changes map[string][]byte) *PublishError {
	now := c.now().UTC()
	err := c.stage().update(w.t, func(files map[string]StagedFile) {
		for p, content := range changes {
			head, onHead := w.head.files[p]
			if (content == nil && !onHead) || (content != nil && onHead && bytes.Equal(content, head.content)) {
				delete(files, p)
				continue
			}
			files[p] = StagedFile{Content: string(content), Deleted: content == nil, Saved: now}
		}
	})
	if err != nil {
		return publishErr(http.StatusInternalServerError, "Couldn't keep the change: %v", err)
	}
	staged, err := c.stage().files(w.t)
	if err != nil {
		return publishErr(http.StatusInternalServerError, "Couldn't read the pending changes: %v", err)
	}
	w.staged = staged
	return nil
}

// pendingSave says where a save went: into the pending changes, which the
// next Commit commits to Branch.
type pendingSave struct {
	// Branch is the photo data pull request's branch, or "" when none is open
	// and Commit will start one.
	Branch            string `json:"branch"`
	PullRequestURL    string `json:"pullRequestUrl,omitempty"`
	PullRequestNumber int    `json:"pullRequestNumber,omitempty"`
	// Changes are the files the save changed, before and after, so the app
	// can show them in the combined lists before they're committed there.
	Changes []ScanChange `json:"changes"`
}

// saveFiles saves changes, before and after, as pending changes, and says
// where they'll be committed.
func (c *Client) saveFiles(w *workspace, changes []ScanChange) (pendingSave, *PublishError) {
	byPath := make(map[string][]byte, len(changes))
	for _, ch := range changes {
		byPath[ch.Path] = nil
		if ch.After != nil {
			byPath[ch.Path] = ch.After
		}
	}
	if perr := c.save(w, byPath); perr != nil {
		return pendingSave{}, perr
	}
	return w.pendingSave(changes), nil
}

// pendingSave is a pendingSave of changes in w.
func (w *workspace) pendingSave(changes []ScanChange) pendingSave {
	out := pendingSave{Changes: changes}
	if w.pr != nil {
		out.Branch, out.PullRequestURL, out.PullRequestNumber = w.pr.Head.Ref, w.pr.HTMLURL, w.pr.Number
	}
	return out
}

// ScanChange is one data file a save changed: its data before and after. After
// is null when the save removed it.
type ScanChange struct {
	Path   string          `json:"path"`
	Before json.RawMessage `json:"before"`
	After  json.RawMessage `json:"after"`
}
