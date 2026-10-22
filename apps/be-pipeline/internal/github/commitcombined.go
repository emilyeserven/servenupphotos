package github

import (
	"context"
	"crypto/sha1" //nolint:gosec // Git's object IDs are SHA-1.
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"sort"
	"strings"
	"sync"

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
}

// CombinedCommit says what CommitCombined did.
type CombinedCommit struct {
	// Changed is false when the combined lists were already up to date, so
	// nothing was committed.
	Changed bool `json:"changed"`
	// CommitSHA and CommitURL are the new commit's, when there is one.
	CommitSHA string `json:"commitSha,omitempty"`
	CommitURL string `json:"commitUrl,omitempty"`
	// Files are the combined lists the commit changed, by path.
	Files []string `json:"files"`
	// Counts are how many entries each combined list has: photos, albums and
	// tags.
	Counts map[string]int `json:"counts"`
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
	query := url.Values{"sha": {pr.Head.SHA}, "path": {root}, "per_page": {"1"}}
	var commits []struct {
		Commit struct {
			Message string `json:"message"`
		} `json:"commit"`
	}
	res, err := c.do(ctx, http.MethodGet, repoPath(t.owner, t.name)+"/commits?"+query.Encode(), t.token, nil, &commits)
	if perr := readCheck(res, err, "reading the branch's commits"); perr != nil {
		return CombinedStatus{}, perr
	}
	status := CombinedStatus{State: CombinedSynced, HeadSHA: pr.Head.SHA}
	if len(commits) > 0 && firstLine(commits[0].Commit.Message) != CombineMessage {
		status.State = CombinedStale
	}
	return status, nil
}

func firstLine(s string) string {
	line, _, _ := strings.Cut(s, "\n")
	return strings.TrimSpace(line)
}

// CommitCombined rebuilds the combined lists on the open photo data pull
// request's branch, as the "Combine photo data" workflow does: each is every
// other JSON file in its folder, sorted by path, as one array. It commits the
// ones that changed as one commit, and nothing when none did or any file can't
// be read.
func (c *Client) CommitCombined(ctx context.Context, gh settings.GitHub) (CombinedCommit, error) {
	root, perr := dataFolder(gh.Folder)
	if perr != nil {
		return CombinedCommit{}, perr
	}
	t, perr := c.target(ctx, gh)
	if perr != nil {
		return CombinedCommit{}, perr
	}
	pr, perr := c.findInFlightPull(ctx, t)
	if perr != nil {
		return CombinedCommit{}, perr
	}
	if pr == nil {
		return CombinedCommit{}, publishErr(http.StatusNotFound, "No pull request titled %q is open.", PullRequestTitle)
	}

	result := CombinedCommit{Files: []string{}, Counts: map[string]int{}}
	var entries []map[string]string
	for _, kind := range combinedKinds() {
		folder := root + "/" + kind.folder
		content, built, perr := c.buildCombined(ctx, t, folder, kind.allFile, pr.Head.SHA)
		if perr != nil {
			return CombinedCommit{}, perr
		}
		result.Counts[kind.name] = built.count
		if built.oldSHA == blobSHA(content) {
			continue
		}
		file := folder + "/" + kind.allFile
		entries = append(entries, map[string]string{"path": file, "mode": "100644", "type": "blob", "content": string(content)})
		result.Files = append(result.Files, file)
	}
	if len(entries) == 0 {
		return result, nil
	}

	commit, perr := c.createCommit(ctx, t, pr.Head.SHA, entries, CombineMessage)
	if perr != nil {
		return CombinedCommit{}, perr
	}
	if perr := c.moveBranch(ctx, t, pr.Head.Ref, commit.SHA); perr != nil {
		return CombinedCommit{}, perr
	}
	result.Changed, result.CommitSHA, result.CommitURL = true, commit.SHA, commit.HTMLURL
	return result, nil
}

// builtCombined is how many files buildCombined combined, and the blob SHA of
// the combined file there was, or "" when there was none.
type builtCombined struct {
	count  int
	oldSHA string
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
func (c *Client) buildCombined(ctx context.Context, t target, folder, allFile, ref string) ([]byte, builtCombined, *PublishError) {
	files, oldSHA, perr := c.listJSONFiles(ctx, t, folder, allFile, ref)
	if perr != nil {
		return nil, builtCombined{}, perr
	}
	contents := make([]json.RawMessage, len(files))
	problems := make([]string, len(files))
	var wg sync.WaitGroup
	sem := make(chan struct{}, readConcurrency)
	for i, f := range files {
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			contents[i], problems[i] = c.readBlob(ctx, t, f.SHA)
		}()
	}
	wg.Wait()

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
	content, err := formatJSONArray(contents)
	if err != nil {
		return nil, builtCombined{}, publishErr(http.StatusInternalServerError, "Couldn't format %s.", allFile)
	}
	return content, builtCombined{count: len(files), oldSHA: oldSHA}, nil
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
