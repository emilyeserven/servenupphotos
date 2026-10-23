package github

import (
	"bytes"
	"context"
	"crypto/sha1" //nolint:gosec // Git's object IDs are SHA-1.
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// CombineMessage is the first line of every commit Commit makes, the same as
// the "Combine photo data" workflow's.
const CombineMessage = "Combine photo, album and tag data"

// CombinedCommit says what CommitCombined did.
type CombinedCommit struct {
	// Changed is false when there was nothing to commit: no pending changes
	// or edits, and the combined lists were already up to date.
	Changed bool `json:"changed"`
	// CommitSHA and CommitURL are the new commit's, when there is one.
	CommitSHA string `json:"commitSha,omitempty"`
	CommitURL string `json:"commitUrl,omitempty"`
	// Files are the files the commit changed, by path: the data files, then
	// the combined lists.
	Files []string `json:"files"`
	// Edited is how many data files the commit changed.
	Edited int `json:"edited"`
	// Counts are how many entries each combined list has: photos, albums,
	// tags, places, localizations, metadata groups (metainfo) and camera
	// overrides (cameras), and how
	// many photos were left out of ALLPHOTOS.json as drafts (drafts).
	Counts map[string]int `json:"counts"`
	// NewPullRequest is true when the commit opened the photo data pull
	// request, which happens when none is open.
	NewPullRequest bool `json:"newPullRequest"`
	// PullRequestURL is the photo data pull request the commit went to.
	PullRequestURL string `json:"pullRequestUrl,omitempty"`
}

// FieldEdit sets top-level fields of the data file at Path, such as a photo's
// socialMediaPublishDate, to JSON values: scalars, or lists such as its
// spotlightZones, which replace the list whole. Only those fields change, so
// the rest of the file keeps its formatting.
type FieldEdit struct {
	Path   string                     `json:"path"`
	Fields map[string]json.RawMessage `json:"fields"`
}

// combinedKind is one folder of data files and the combined list built from it.
type combinedKind struct {
	name, folder, allFile string
}

func combinedKinds() []combinedKind {
	return []combinedKind{
		{"photos", PhotosFolder, AllPhotosFile},
		{"albums", Albums.Folder, Albums.AllFile},
		{"tags", Tags.Folder, Tags.AllFile},
		{"places", Places.Folder, Places.AllFile},
		{"localizations", Localizations.Folder, Localizations.AllFile},
		{"metainfo", MetaInfo.Folder, MetaInfo.AllFile},
		{"cameras", Cameras.Folder, Cameras.AllFile},
	}
}

// CommitCombined commits every pending change, with edits made over the data
// files, and the combined lists rebuilt from the result, as the "Combine
// photo data" workflow does (each is every other JSON file in its folder,
// sorted by path, as one array, but without untitled photos unless Settings
// include them: see isDraft), as one commit on the open photo data pull
// request's branch. With none open, it commits to a new photo-data/ branch
// from the base branch and opens one. Nothing is committed when a file can't
// be read. It makes 3 GitHub calls (a tree, a commit and the branch moving to
// it), plus 2 to open the pull request when it opens one.
func (c *Client) CommitCombined(ctx context.Context, gh settings.GitHub, edits []FieldEdit) (CombinedCommit, error) {
	byPath, perr := editsByPath(edits)
	if perr != nil {
		return CombinedCommit{}, perr
	}
	// Where the branch stands comes from the read when the app started, not a
	// new one: GitHub refuses to move a branch that moved since, and then
	// the next Commit reads it again.
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return CombinedCommit{}, perr
	}
	changes, perr := w.commitChanges(byPath)
	if perr != nil {
		return CombinedCommit{}, perr
	}
	result := CombinedCommit{Files: []string{}, Counts: map[string]int{}}
	for _, kind := range combinedKinds() {
		if perr := w.addCombined(kind, changes, result.Counts); perr != nil {
			return CombinedCommit{}, perr
		}
	}
	result.Files, result.Edited = changedPaths(changes)
	// With nothing in flight, a stale list on the base branch isn't worth a new pull request.
	if len(changes) == 0 || (w.pr == nil && result.Edited == 0) {
		result.Files = []string{}
		return result, nil
	}
	if perr := c.commit(ctx, w, changes, combineMessage(result.Edited), &result); perr != nil {
		return CombinedCommit{}, perr
	}
	c.committed(w)
	return result, nil
}

// commitChanges is every file the commit changes besides the combined lists:
// the pending changes, with edits made over them, by path (nil content
// deletes). It fails when an edit names a file that isn't there.
func (w *workspace) commitChanges(edits map[string]FieldEdit) (map[string][]byte, *PublishError) {
	changes := map[string][]byte{}
	for p, f := range w.staged {
		changes[p] = f.data()
	}
	var missing []string
	for p, edit := range edits {
		content, ok := w.file(p)
		if !ok || w.readErr(p) != "" {
			missing = append(missing, p)
			continue
		}
		edited, err := applyEdit(content, edit)
		if err != nil {
			return nil, publishErr(http.StatusConflict, "%s: %s, so nothing was committed.", p, err)
		}
		changes[p] = edited
	}
	if len(missing) > 0 {
		sort.Strings(missing)
		return nil, publishErr(http.StatusNotFound, "%s isn't a data file on %s, so nothing was committed.", strings.Join(missing, ", "), w.branch())
	}
	for p, content := range changes {
		if content != nil && strings.HasSuffix(p, ".json") {
			content = formatJSONFile(content)
			changes[p] = content
		}
		head, onHead := w.head.files[p]
		if (content == nil && !onHead) || (content != nil && onHead && bytes.Equal(content, head.content)) {
			delete(changes, p)
		}
	}
	return changes, nil
}

// addCombined builds kind's combined list from its data files with changes
// made, adds it to changes when it differs from the one at the head, and
// counts its entries in counts.
func (w *workspace) addCombined(kind combinedKind, changes map[string][]byte, counts map[string]int) *PublishError {
	folder := w.root + "/" + kind.folder
	view := w.withChanges(changes)
	contents, drafts, perr := view.combinedEntries(kind)
	if perr != nil {
		return perr
	}
	content, err := formatJSONArray(contents)
	if err != nil {
		return publishErr(http.StatusInternalServerError, "Couldn't format %s.", kind.allFile)
	}
	counts[kind.name] = len(contents)
	if kind.name == "photos" {
		counts["drafts"] = drafts
	}
	all := folder + "/" + kind.allFile
	if old, ok := w.head.files[all]; !ok || old.sha != blobSHA(content) {
		changes[all] = content
	}
	return nil
}

// combinedEntries is the data of kind's files in w, sorted by path, without
// the ones left out of its combined list (see leftOut), and how many were
// left out. It fails when a file can't be read.
func (w *workspace) combinedEntries(kind combinedKind) ([]json.RawMessage, int, *PublishError) {
	contents := []json.RawMessage{}
	var unreadable []string
	drafts := 0
	for _, p := range w.paths(w.root+"/"+kind.folder, kind.allFile) {
		data, msg := w.json(p)
		switch {
		case msg != "":
			unreadable = append(unreadable, fmt.Sprintf("%s (%s)", p, msg))
		case w.leftOut(kind, data):
			drafts++
		default:
			contents = append(contents, data)
		}
	}
	if len(unreadable) > 0 {
		return nil, 0, publishErr(http.StatusUnprocessableEntity,
			"Nothing was committed, since %d file(s) couldn't be read: %s", len(unreadable), strings.Join(unreadable, "; "))
	}
	return contents, drafts, nil
}

// withChanges is w with changes as its only pending changes.
func (w *workspace) withChanges(changes map[string][]byte) *workspace {
	view := *w
	view.staged = make(map[string]StagedFile, len(changes))
	for p, content := range changes {
		view.staged[p] = StagedFile{Content: string(content), Deleted: content == nil}
	}
	return &view
}

// changedPaths is the paths changes changes, data files first and then the
// combined lists, each sorted, and how many are data files.
func changedPaths(changes map[string][]byte) ([]string, int) {
	var data, combined []string
	for p := range changes {
		if isCombinedFile(p) {
			combined = append(combined, p)
		} else {
			data = append(data, p)
		}
	}
	sort.Strings(data)
	sort.Strings(combined)
	return append(data, combined...), len(data)
}

// isCombinedFile reports one of the combined lists, by its name.
func isCombinedFile(p string) bool {
	name := p[strings.LastIndex(p, "/")+1:]
	for _, k := range combinedKinds() {
		if name == k.allFile {
			return true
		}
	}
	return false
}

// combineMessage is CommitCombined's commit message. Its first line is always
// CombineMessage.
func combineMessage(edited int) string {
	if edited == 0 {
		return CombineMessage
	}
	return fmt.Sprintf("%s\n\nAlso saves changes to %d data %s.", CombineMessage, edited, plural(edited, "file"))
}

// editsByPath checks edits and keys them by path. Each path may be edited once.
func editsByPath(edits []FieldEdit) (map[string]FieldEdit, *PublishError) {
	byPath := map[string]FieldEdit{}
	for _, e := range edits {
		if _, dup := byPath[e.Path]; dup {
			return nil, publishErr(http.StatusBadRequest, "%s is edited more than once.", e.Path)
		}
		for key, value := range e.Fields {
			if !json.Valid(value) {
				return nil, publishErr(http.StatusBadRequest, "%s: %s isn't valid JSON.", e.Path, key)
			}
		}
		byPath[e.Path] = e
	}
	return byPath, nil
}

// applyEdit is content with edit's fields set, in key order.
func applyEdit(content []byte, edit FieldEdit) ([]byte, error) {
	keys := make([]string, 0, len(edit.Fields))
	for key := range edit.Fields {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		var err error
		if content, err = setField(content, key, edit.Fields[key]); err != nil {
			return nil, err
		}
	}
	return content, nil
}

// setField is setTopLevel for a scalar value, and setTopLevelList, indented
// as a top-level value, for a list or object.
func setField(content []byte, key string, value json.RawMessage) ([]byte, error) {
	trimmed := bytes.TrimSpace(value)
	if len(trimmed) == 0 || (trimmed[0] != '[' && trimmed[0] != '{') {
		return setTopLevel(content, key, value)
	}
	var indented bytes.Buffer
	if err := json.Indent(&indented, trimmed, "  ", "  "); err != nil {
		return nil, err
	}
	return setTopLevelList(content, key, indented.Bytes())
}

// blobSHA is the Git blob SHA of content, as GitHub lists it for a file.
func blobSHA(content []byte) string {
	header := fmt.Sprintf("blob %d\x00", len(content))
	sum := sha1.Sum(append([]byte(header), content...)) //nolint:gosec // Git's object ID, not a security hash.
	return hex.EncodeToString(sum[:])
}

// gitCommit is the part of a created commit used.
type gitCommit struct {
	SHA     string `json:"sha"`
	HTMLURL string `json:"html_url"`
}

// commit commits changes (nil content deletes a file) on top of w's head as
// one commit with the Git data API: one tree, one commit, and the branch
// moved to it, or a new branch and pull request when none is open. See
// https://docs.github.com/en/rest/git/trees#create-a-tree
func (c *Client) commit(ctx context.Context, w *workspace, changes map[string][]byte, message string, result *CombinedCommit) *PublishError {
	t, repo := w.t, repoPath(w.t.owner, w.t.name)
	entries := make([]map[string]any, 0, len(changes))
	for _, p := range result.Files {
		entry := map[string]any{"path": p, "mode": "100644", "type": "blob", "sha": nil}
		if content := changes[p]; content != nil {
			delete(entry, "sha")
			entry["content"] = string(content)
		}
		entries = append(entries, entry)
	}
	var tree struct {
		SHA string `json:"sha"`
	}
	res, err := c.do(ctx, http.MethodPost, repo+"/git/trees", t.token, map[string]any{"base_tree": w.head.tree, "tree": entries}, &tree)
	if perr := check(res, err, "saving the changed files"); perr != nil {
		return perr
	}
	var commit gitCommit
	body := map[string]any{"message": message, "tree": tree.SHA, "parents": []string{w.head.commit}}
	res, err = c.do(ctx, http.MethodPost, repo+"/git/commits", t.token, body, &commit)
	if perr := check(res, err, "making the commit"); perr != nil {
		return perr
	}
	result.Changed, result.CommitSHA, result.CommitURL = true, commit.SHA, commit.HTMLURL
	w.head = w.head.withChanges(commit.SHA, tree.SHA, changes)
	if w.pr != nil {
		result.PullRequestURL = w.pr.HTMLURL
		if perr := c.moveBranch(ctx, t, w.pr.Head.Ref, commit.SHA); perr != nil {
			c.reads().forget(w.key)
			return perr
		}
		pr := *w.pr
		pr.Head.SHA = commit.SHA
		w.pr = &pr
		return nil
	}
	return c.openBatch(ctx, w, commit.SHA, result)
}

// openBatch puts commit on a new photo-data/ branch and opens the photo data
// pull request from it.
func (c *Client) openBatch(ctx context.Context, w *workspace, commit string, result *CombinedCommit) *PublishError {
	branch := BranchPrefix + c.now().UTC().Format("2006-01-02-150405")
	body := map[string]string{"ref": "refs/heads/" + branch, "sha": commit}
	res, err := c.do(ctx, http.MethodPost, repoPath(w.t.owner, w.t.name)+"/git/refs", w.t.token, body, nil)
	if perr := check(res, err, "creating the branch"); perr != nil {
		return perr
	}
	pr, perr := c.openPullRequest(ctx, w.t, branch)
	if perr != nil {
		return perr
	}
	result.NewPullRequest, result.PullRequestURL = true, pr.HTMLURL
	w.pr = &inFlightPull{Number: pr.Number, Title: PullRequestTitle, HTMLURL: pr.HTMLURL}
	w.pr.Head.Ref, w.pr.Head.SHA, w.pr.Base.Ref = branch, commit, w.t.base
	return nil
}

// moveBranch fast-forwards branch to sha.
func (c *Client) moveBranch(ctx context.Context, t target, branch, sha string) *PublishError {
	body := map[string]any{"sha": sha, "force": false}
	res, err := c.do(ctx, http.MethodPatch, repoPath(t.owner, t.name)+"/git/refs/heads/"+escapePath(branch), t.token, body, nil)
	// GitHub answers 422 when the branch moved since it was read.
	if err == nil && (res.Status == http.StatusUnprocessableEntity || res.Status == http.StatusConflict) {
		return publishErr(http.StatusConflict, "%s changed on GitHub while the files were being committed. Try again; nothing was lost.", branch)
	}
	return check(res, err, "updating the branch")
}

// committed drops the pending changes the commit has, keeping any saved while
// it ran, and keeps where the repository now stands, so nothing has to be
// read again.
func (c *Client) committed(w *workspace) {
	_ = c.stage().update(w.t, func(files map[string]StagedFile) {
		for p, f := range w.staged {
			if files[p] == f {
				delete(files, p)
			}
		}
	})
	s := w.repoState
	s.at = c.now()
	c.keepState(s)
	c.keepSnapshot(snapshotKey(w.t, w.root, w.head.commit), w.head)
}
