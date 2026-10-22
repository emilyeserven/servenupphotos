package github

import (
	"bytes"
	"cmp"
	"context"
	"crypto/sha1" //nolint:gosec // Git's object IDs are SHA-1.
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"slices"
	"sort"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// CombineMessage is the message of the commit that rebuilds the combined
// lists, the same as the "Combine photo data" workflow's, so CombinedStatus
// knows either one.
const CombineMessage = "Combine photo, album and tag data"

// Combined sync states.
const (
	// CombinedSynced means the newest commit on the pull request's branch to
	// change the data folder rebuilt the combined lists.
	CombinedSynced = "synced"
	// CombinedStale means the data folder changed after the combined lists
	// were last rebuilt.
	CombinedStale = "stale"
	// CombinedNoPullRequest means no pull request titled PullRequestTitle is
	// open, so nothing is in flight.
	CombinedNoPullRequest = "none"
)

// CombinedStatus is whether the combined lists on the photo data pull request
// have its latest changes.
type CombinedStatus struct {
	State string `json:"state"`
	// HeadSHA is the pull request's head; empty with no pull request.
	HeadSHA string `json:"headSha,omitempty"`
	// Pending are the data files the pull request changed after the combined
	// lists were last rebuilt, when they're stale and GitHub could list them.
	Pending []PendingFile `json:"pending,omitempty"`
}

// CombinedCommit says what CommitCombined did.
type CombinedCommit struct {
	// Changed is false when the combined lists were already up to date and
	// there were no edits, so nothing was committed.
	Changed bool `json:"changed"`
	// CommitSHA and CommitURL are the new commit's, when there is one.
	CommitSHA string `json:"commitSha,omitempty"`
	CommitURL string `json:"commitUrl,omitempty"`
	// Files are the files the commit changed, by path: the edited data files,
	// then the combined lists.
	Files []string `json:"files"`
	// Edited is how many data files the edits changed.
	Edited int `json:"edited"`
	// Counts are how many entries each combined list has: photos, albums,
	// tags, places and localizations.
	Counts map[string]int `json:"counts"`
	// NewPullRequest is true when the commit opened the photo data pull
	// request, which happens when there are edits and none is open.
	NewPullRequest bool `json:"newPullRequest"`
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
	}
}

// CombinedStatus reports whether the combined lists at the head of the open
// photo data pull request have its latest changes, from the newest commit on
// its branch that changed the data folder. It only reads from GitHub.
func (c *Client) CombinedStatus(ctx context.Context, gh settings.GitHub) (CombinedStatus, error) {
	root, perr := dataFolder(gh.Folder)
	if perr != nil {
		return CombinedStatus{}, perr
	}
	t, perr := c.target(ctx, gh)
	if perr != nil {
		return CombinedStatus{}, perr
	}
	pr, perr := c.findInFlightPull(ctx, t)
	if perr != nil {
		return CombinedStatus{}, perr
	}
	if pr == nil {
		return CombinedStatus{State: CombinedNoPullRequest}, nil
	}
	combined, perr := c.lastCombine(ctx, t, root, pr.Head.SHA)
	if perr != nil {
		return CombinedStatus{}, perr
	}
	status := CombinedStatus{State: CombinedSynced, HeadSHA: pr.Head.SHA}
	if combined.newest {
		return status, nil
	}
	status.State = CombinedStale
	// Without a rebuild among the recent commits, everything the pull request changes is pending.
	from := cmp.Or(combined.sha, pr.Base.Ref)
	status.Pending = c.pendingFiles(ctx, t, root, from, pr.Head.SHA)
	return status, nil
}

// combineCommit is where the newest commit that rebuilt the combined lists is
// among the recent commits to the data folder.
type combineCommit struct {
	// sha is that commit's, or "" when none of the recent commits is one.
	sha string
	// newest is true when it's the newest commit to the data folder, or when
	// nothing has changed the data folder.
	newest bool
}

// branchCommit is the part of a listed commit lastCombine uses.
type branchCommit struct {
	SHA    string `json:"sha"`
	Commit struct {
		Message string `json:"message"`
	} `json:"commit"`
}

// lastCombine finds the newest of the last 100 commits to the data folder at
// head that rebuilt the combined lists.
func (c *Client) lastCombine(ctx context.Context, t target, root, head string) (combineCommit, *PublishError) {
	query := url.Values{"sha": {head}, "path": {root}, "per_page": {"100"}}
	var commits []branchCommit
	res, err := c.do(ctx, http.MethodGet, repoPath(t.owner, t.name)+"/commits?"+query.Encode(), t.token, nil, &commits)
	if perr := readCheck(res, err, "reading the branch's commits"); perr != nil {
		return combineCommit{}, perr
	}
	at := slices.IndexFunc(commits, func(commit branchCommit) bool {
		return firstLine(commit.Commit.Message) == CombineMessage
	})
	if at == -1 {
		return combineCommit{newest: len(commits) == 0}, nil
	}
	return combineCommit{sha: commits[at].SHA, newest: at == 0}, nil
}

func firstLine(s string) string {
	line, _, _ := strings.Cut(s, "\n")
	return strings.TrimSpace(line)
}

// CommitCombined applies edits to the data files on the open photo data pull
// request's branch and rebuilds the combined lists from them, as the "Combine
// photo data" workflow does: each is every other JSON file in its folder,
// sorted by path, as one array. It commits the edited files and the lists
// that changed as one commit, and nothing when none did or any file can't be
// read. With edits and no pull request open, it commits to a new photo-data/
// branch from the base branch and opens one.
func (c *Client) CommitCombined(ctx context.Context, gh settings.GitHub, edits []FieldEdit) (CombinedCommit, error) {
	root, perr := dataFolder(gh.Folder)
	if perr != nil {
		return CombinedCommit{}, perr
	}
	byPath, perr := editsByPath(edits)
	if perr != nil {
		return CombinedCommit{}, perr
	}
	t, perr := c.target(ctx, gh)
	if perr != nil {
		return CombinedCommit{}, perr
	}
	scan, perr := c.combinedTarget(ctx, t, len(edits) > 0)
	if perr != nil {
		return CombinedCommit{}, perr
	}

	result := CombinedCommit{Files: []string{}, Counts: map[string]int{}}
	var edited, combined []map[string]string
	var applied []string
	for _, kind := range combinedKinds() {
		folder := root + "/" + kind.folder
		content, built, perr := c.buildCombined(ctx, t, folder, kind.allFile, scan.headSHA, byPath)
		if perr != nil {
			return CombinedCommit{}, perr
		}
		result.Counts[kind.name] = built.count
		edited, applied = append(edited, built.edited...), append(applied, built.applied...)
		if built.oldSHA == blobSHA(content) {
			continue
		}
		file := folder + "/" + kind.allFile
		combined = append(combined, map[string]string{"path": file, "mode": "100644", "type": "blob", "content": string(content)})
	}
	if missing := unappliedEdits(byPath, applied); missing != "" {
		return CombinedCommit{}, publishErr(http.StatusNotFound, "%s isn't a data file on %s, so nothing was committed.", missing, scan.branch)
	}
	entries := slices.Concat(edited, combined)
	if len(entries) == 0 {
		return result, nil
	}
	for _, e := range entries {
		result.Files = append(result.Files, e["path"])
	}

	saved, perr := c.commitScan(ctx, scan, entries, combineMessage(len(edited)))
	if perr != nil {
		return CombinedCommit{}, perr
	}
	result.Changed, result.CommitSHA, result.CommitURL = true, saved.CommitSHA, saved.CommitURL
	result.Edited, result.NewPullRequest = len(edited), saved.NewPullRequest
	return result, nil
}

// combinedTarget is where CommitCombined commits: the open photo data pull
// request's head, or, with edits and none open, the base branch's head, for
// commitScan to put on a new branch.
func (c *Client) combinedTarget(ctx context.Context, t target, hasEdits bool) (baseURLScan, *PublishError) {
	pr, perr := c.findInFlightPull(ctx, t)
	if perr != nil {
		return baseURLScan{}, perr
	}
	if pr != nil {
		scan := baseURLScan{t: t, branch: pr.Head.Ref, headSHA: pr.Head.SHA, pr: &pullRequest{Number: pr.Number, HTMLURL: pr.HTMLURL}}
		scan.pr.Head.Ref = pr.Head.Ref
		return scan, nil
	}
	if !hasEdits {
		return baseURLScan{}, publishErr(http.StatusNotFound, "No pull request titled %q is open.", PullRequestTitle)
	}
	head, perr := c.branchHead(ctx, t, t.base)
	return baseURLScan{t: t, branch: t.base, headSHA: head}, perr
}

// combineMessage is CommitCombined's commit message. Its first line is always
// CombineMessage, so CombinedStatus knows the commit.
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

// unappliedEdits names the edited paths that no data file had, or "".
func unappliedEdits(byPath map[string]FieldEdit, applied []string) string {
	found := map[string]bool{}
	for _, p := range applied {
		found[p] = true
	}
	var missing []string
	for p := range byPath {
		if !found[p] {
			missing = append(missing, p)
		}
	}
	sort.Strings(missing)
	return strings.Join(missing, ", ")
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

// builtCombined is how many files buildCombined combined, and the blob SHA of
// the combined file there was, or "" when there was none.
type builtCombined struct {
	count  int
	oldSHA string
	// edited are the tree entries of the files edits changed, and applied the
	// paths of every file an edit named.
	edited  []map[string]string
	applied []string
}

// blobSHA is the Git blob SHA of content, as GitHub lists it for a file.
func blobSHA(content []byte) string {
	header := fmt.Sprintf("blob %d\x00", len(content))
	sum := sha1.Sum(append([]byte(header), content...)) //nolint:gosec // Git's object ID, not a security hash.
	return hex.EncodeToString(sum[:])
}

// buildCombined reads every JSON file directly in folder at ref except
// allFile and prints them as allFile's array. A folder that isn't there makes
// an empty array.
func (c *Client) buildCombined(ctx context.Context, t target, folder, allFile, ref string, edits map[string]FieldEdit) ([]byte, builtCombined, *PublishError) {
	files, oldSHA, perr := c.listJSONFiles(ctx, t, folder, allFile, ref)
	if perr != nil {
		return nil, builtCombined{}, perr
	}
	contents, problems := c.readBlobs(ctx, t, files)

	var unreadable []string
	for i, problem := range problems {
		if problem != "" {
			unreadable = append(unreadable, fmt.Sprintf("%s (%s)", files[i].Path, problem))
		}
	}
	if len(unreadable) > 0 {
		return nil, builtCombined{}, publishErr(http.StatusUnprocessableEntity,
			"Nothing was committed, since %d file(s) couldn't be read: %s", len(unreadable), strings.Join(unreadable, "; "))
	}
	edited, applied, perr := editFiles(files, contents, edits)
	if perr != nil {
		return nil, builtCombined{}, perr
	}
	content, err := formatJSONArray(contents)
	if err != nil {
		return nil, builtCombined{}, publishErr(http.StatusInternalServerError, "Couldn't format %s.", allFile)
	}
	return content, builtCombined{count: len(files), oldSHA: oldSHA, edited: edited, applied: applied}, nil
}

// editFiles applies edits to the files they name, in contents, and returns
// tree entries for the ones that changed and the paths of every file an edit
// named, changed or not.
func editFiles(files []folderEntry, contents []json.RawMessage, edits map[string]FieldEdit) ([]map[string]string, []string, *PublishError) {
	var entries []map[string]string
	var applied []string
	for i, f := range files {
		edit, ok := edits[f.Path]
		if !ok {
			continue
		}
		applied = append(applied, f.Path)
		content, err := applyEdit(contents[i], edit)
		if err != nil {
			return nil, nil, publishErr(http.StatusConflict, "%s: %s, so nothing was committed.", f.Path, err)
		}
		if bytes.Equal(content, contents[i]) {
			continue
		}
		contents[i] = content
		entries = append(entries, map[string]string{"path": f.Path, "mode": "100644", "type": "blob", "content": string(content)})
	}
	return entries, applied, nil
}

// listJSONFiles lists the .json files directly in folder at ref except
// allFile, sorted by path as `LC_ALL=C sort` sorts them, and allFile's blob
// SHA, or "" when it isn't there. A folder that isn't there has neither.
func (c *Client) listJSONFiles(ctx context.Context, t target, folder, allFile, ref string) ([]folderEntry, string, *PublishError) {
	var entries []folderEntry
	p := repoPath(t.owner, t.name) + "/contents/" + escapePath(folder) + "?ref=" + url.QueryEscape(ref)
	res, err := c.do(ctx, http.MethodGet, p, t.token, nil, &entries)
	if err == nil && res.Status == http.StatusNotFound {
		return nil, "", nil
	}
	if perr := readCheck(res, err, "listing the data folder"); perr != nil {
		return nil, "", perr
	}
	var files []folderEntry
	allSHA := ""
	for _, e := range entries {
		switch {
		case e.Type != "file" || path.Ext(e.Name) != ".json":
		case e.Name == allFile:
			allSHA = e.SHA
		default:
			files = append(files, e)
		}
	}
	sort.Slice(files, func(i, j int) bool { return files[i].Path < files[j].Path })
	return files, allSHA, nil
}

// readBlob reads the JSON file in blob sha, or says why it couldn't.
func (c *Client) readBlob(ctx context.Context, t target, sha string) (json.RawMessage, string) {
	var blob struct {
		Content  string `json:"content"`
		Encoding string `json:"encoding"`
	}
	res, err := c.do(ctx, http.MethodGet, repoPath(t.owner, t.name)+"/git/blobs/"+url.PathEscape(sha), t.token, nil, &blob)
	if perr := readCheck(res, err, "reading the file"); perr != nil {
		return nil, perr.Message
	}
	content, err := base64.StdEncoding.DecodeString(strings.ReplaceAll(blob.Content, "\n", ""))
	if blob.Encoding != "base64" || err != nil {
		return nil, "GitHub returned content that couldn't be decoded"
	}
	if !json.Valid(content) {
		return nil, "it isn't valid JSON"
	}
	return content, ""
}
