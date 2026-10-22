package github

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"sort"
	"strings"
	"sync"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// readConcurrency is how many photo files BaseURL reads from GitHub at once.
const readConcurrency = 8

// skippedDataFiles are the JSON files in the data folder that aren't photos,
// as the Combine photo data workflow skips them.
var skippedDataFiles = map[string]bool{"allphotos.json": true, "dummy.json": true}

// ImageOrigin is one scheme and host the photo files' image URLs point at.
type ImageOrigin struct {
	Origin string `json:"origin"`
	// URLs is how many image URLs use it.
	URLs int `json:"urls"`
	// Files is how many photo files have at least one of them.
	Files int `json:"files"`
}

// URLChange is one image URL a base URL change rewrites.
type URLChange struct {
	// Field is where the URL is in the photo's JSON, such as "images.medium".
	Field string `json:"field"`
	From  string `json:"from"`
	To    string `json:"to"`
}

// BaseURLFile is a photo JSON file whose image URLs change.
type BaseURLFile struct {
	Path    string      `json:"path"`
	FileURL string      `json:"fileUrl"`
	Changes []URLChange `json:"changes"`
}

// BaseURLUnreadable is a photo JSON file that couldn't be read or parsed.
type BaseURLUnreadable struct {
	Path  string `json:"path"`
	Error string `json:"error"`
}

// BaseURLPullRequest is the open photo data pull request a change goes to.
type BaseURLPullRequest struct {
	Number int    `json:"number"`
	URL    string `json:"url"`
}

// BaseURLPreview is what changing the image base URL from From to To would do
// to the photo JSON files on Branch.
type BaseURLPreview struct {
	Repo   string `json:"repo"`
	Folder string `json:"folder"`
	// Branch is where the files were read: the open photo data pull request's
	// branch when there is one, which the change is committed to, or the base
	// branch, from which a new pull request would start.
	Branch      string              `json:"branch"`
	PullRequest *BaseURLPullRequest `json:"pullRequest"`
	// From and To are the base URLs as given, cleaned up; empty when not given.
	From string `json:"from"`
	To   string `json:"to"`
	// PhotoFiles is how many photo files were read.
	PhotoFiles int           `json:"photoFiles"`
	Origins    []ImageOrigin `json:"origins"`
	// Files are the photo files with an image URL under From, by path.
	Files      []BaseURLFile       `json:"files"`
	URLs       int                 `json:"urls"`
	Unreadable []BaseURLUnreadable `json:"unreadable"`
}

// BaseURLResult says where a base URL change was committed.
type BaseURLResult struct {
	Branch            string `json:"branch"`
	CommitSHA         string `json:"commitSha"`
	CommitURL         string `json:"commitUrl"`
	PullRequestURL    string `json:"pullRequestUrl"`
	PullRequestNumber int    `json:"pullRequestNumber"`
	// NewPullRequest is true when the change opened the pull request.
	NewPullRequest bool `json:"newPullRequest"`
	Files          int  `json:"files"`
	URLs           int  `json:"urls"`
	// Changes are the files the commit changed, before and after.
	Changes []ScanChange `json:"changes"`
}

// photoFile is a photo JSON file read for a base URL change.
type photoFile struct {
	path, fileURL string
	content       []byte
	leaves        []imageString
	err           string
}

// baseURLScan is a read of every photo file on one commit.
type baseURLScan struct {
	t       target
	folder  string
	branch  string
	headSHA string
	pr      *pullRequest
	files   []photoFile
}

// PreviewBaseURL reads every photo JSON file in gh's folder and reports the
// origins of their image URLs, and, when from and to are given, which URLs
// moving the images from base URL from to base URL to would rewrite. Files
// are read on the open photo data pull request's branch when there is one,
// so photos in flight are included, and on the base branch otherwise. It only
// reads from GitHub.
func (c *Client) PreviewBaseURL(ctx context.Context, gh settings.GitHub, from, to string) (BaseURLPreview, error) {
	from, to, perr := baseURLPair(from, to, false)
	if perr != nil {
		return BaseURLPreview{}, perr
	}
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return BaseURLPreview{}, perr
	}
	preview := BaseURLPreview{
		Repo: scan.t.repo.FullName, Folder: scan.folder, Branch: scan.branch, From: from, To: to,
		Origins: []ImageOrigin{}, Files: []BaseURLFile{}, Unreadable: []BaseURLUnreadable{},
	}
	if scan.pr != nil {
		preview.PullRequest = &BaseURLPullRequest{Number: scan.pr.Number, URL: scan.pr.HTMLURL}
	}
	preview.Origins = origins(scan.files)
	for _, f := range scan.files {
		if f.err != "" {
			preview.Unreadable = append(preview.Unreadable, BaseURLUnreadable{Path: f.path, Error: f.err})
			continue
		}
		preview.PhotoFiles++
		if from == "" {
			continue
		}
		if changes := rebaseAll(f.leaves, from, to); len(changes) > 0 {
			preview.Files = append(preview.Files, BaseURLFile{Path: f.path, FileURL: f.fileURL, Changes: changes})
			preview.URLs += len(changes)
		}
	}
	return preview, nil
}

// ReplaceBaseURL rewrites every image URL under base URL from to start with
// base URL to instead, in all the photo JSON files PreviewBaseURL reads, as
// one commit on the open photo data pull request's branch. With no such pull
// request open, it commits to a new photo-data/ branch from the base branch
// and opens one. Nothing is committed when any photo file can't be read.
func (c *Client) ReplaceBaseURL(ctx context.Context, gh settings.GitHub, from, to string) (BaseURLResult, error) {
	from, to, perr := baseURLPair(from, to, true)
	if perr != nil {
		return BaseURLResult{}, perr
	}
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return BaseURLResult{}, perr
	}

	var entries []map[string]string
	result := BaseURLResult{}
	for _, f := range scan.files {
		if f.err != "" {
			return BaseURLResult{}, publishErr(http.StatusConflict,
				"%s couldn't be read (%s), so nothing was changed.", f.path, f.err)
		}
		changes := rebaseAll(f.leaves, from, to)
		if len(changes) == 0 {
			continue
		}
		entries = append(entries, map[string]string{
			"path": f.path, "mode": "100644", "type": "blob", "content": string(rewrite(f.content, f.leaves, from, to)),
		})
		result.Files++
		result.URLs += len(changes)
	}
	if len(entries) == 0 {
		return BaseURLResult{}, publishErr(http.StatusConflict, "No image URLs start with %s, so there's nothing to change.", from)
	}

	message := fmt.Sprintf("Change image base URL from %s to %s", from, to)
	saved, perr := c.commitScan(ctx, scan, entries, message)
	if perr != nil {
		return BaseURLResult{}, perr
	}
	result.Branch, result.CommitSHA, result.CommitURL = saved.Branch, saved.CommitSHA, saved.CommitURL
	result.PullRequestURL, result.PullRequestNumber = saved.PullRequestURL, saved.PullRequestNumber
	result.NewPullRequest, result.Changes = saved.NewPullRequest, saved.Changes
	return result, nil
}

// scanCommit says where commitScan committed.
type scanCommit struct {
	Branch            string `json:"branch"`
	CommitSHA         string `json:"commitSha"`
	CommitURL         string `json:"commitUrl"`
	PullRequestURL    string `json:"pullRequestUrl"`
	PullRequestNumber int    `json:"pullRequestNumber"`
	// NewPullRequest is true when the commit opened the pull request.
	NewPullRequest bool `json:"newPullRequest"`
	// Changes are the files the commit changed, before and after, so the app
	// can show them in the combined lists before they're committed there.
	Changes []ScanChange `json:"changes"`
}

// ScanChange is one photo file commitScan changed: its data before and after.
type ScanChange struct {
	Path   string          `json:"path"`
	Before json.RawMessage `json:"before"`
	After  json.RawMessage `json:"after"`
}

// scanChanges pairs each entry with the file scan read at its path.
func scanChanges(scan baseURLScan, entries []map[string]string) []ScanChange {
	before := map[string][]byte{}
	for _, f := range scan.files {
		before[f.path] = f.content
	}
	changes := make([]ScanChange, 0, len(entries))
	for _, e := range entries {
		changes = append(changes, ScanChange{Path: e["path"], Before: before[e["path"]], After: json.RawMessage(e["content"])})
	}
	return changes
}

// commitScan commits entries on top of the commit scan read, on the open
// photo data pull request's branch. With no such pull request open, it
// commits to a new photo-data/ branch from the base branch and opens one.
func (c *Client) commitScan(ctx context.Context, scan baseURLScan, entries []map[string]string, message string) (scanCommit, *PublishError) {
	commit, perr := c.createCommit(ctx, scan.t, scan.headSHA, entries, message)
	if perr != nil {
		return scanCommit{}, perr
	}
	result := scanCommit{CommitSHA: commit.SHA, CommitURL: commit.HTMLURL, Changes: scanChanges(scan, entries)}

	if scan.pr != nil {
		if perr := c.moveBranch(ctx, scan.t, scan.branch, commit.SHA); perr != nil {
			return scanCommit{}, perr
		}
		result.Branch = scan.branch
		result.PullRequestURL, result.PullRequestNumber = scan.pr.HTMLURL, scan.pr.Number
		return result, nil
	}

	result.Branch = BranchPrefix + c.now().UTC().Format("2006-01-02-150405")
	body := map[string]string{"ref": "refs/heads/" + result.Branch, "sha": commit.SHA}
	res, err := c.do(ctx, http.MethodPost, repoPath(scan.t.owner, scan.t.name)+"/git/refs", scan.t.token, body, nil)
	if perr := check(res, err, "creating the branch"); perr != nil {
		return scanCommit{}, perr
	}
	pr, perr := c.openPullRequest(ctx, scan.t, result.Branch)
	if perr != nil {
		return scanCommit{}, perr
	}
	result.PullRequestURL, result.PullRequestNumber, result.NewPullRequest = pr.HTMLURL, pr.Number, true
	return result, nil
}

// baseURLPair cleans up from and to. They may both be empty unless required.
func baseURLPair(from, to string, required bool) (string, string, *PublishError) {
	if !required && strings.TrimSpace(from) == "" && strings.TrimSpace(to) == "" {
		return "", "", nil
	}
	from, ok := cleanBaseURL(from)
	if !ok {
		return "", "", publishErr(http.StatusBadRequest, "The current base URL should be an http or https URL, such as https://pub-1234.r2.dev.")
	}
	to, ok = cleanBaseURL(to)
	if !ok {
		return "", "", publishErr(http.StatusBadRequest, "The new base URL should be an http or https URL, such as https://photos.example.com.")
	}
	if from == to {
		return "", "", publishErr(http.StatusBadRequest, "The new base URL is the same as the current one.")
	}
	return from, to, nil
}

// cleanBaseURL trims raw and its trailing slashes, and reports whether what's
// left is an http or https URL with a host and nothing after its path.
func cleanBaseURL(raw string) (string, bool) {
	s := strings.TrimRight(strings.TrimSpace(raw), "/")
	u, err := url.Parse(s)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" ||
		u.User != nil || u.RawQuery != "" || u.ForceQuery || u.Fragment != "" || strings.Contains(s, "#") {
		return "", false
	}
	return s, true
}

// rebase returns u moved from base URL from to base URL to, and false when u
// isn't under from: equal to it, or followed by a path, query or fragment.
func rebase(u, from, to string) (string, bool) {
	rest, ok := strings.CutPrefix(u, from)
	if !ok || (rest != "" && !strings.ContainsRune("/?#", rune(rest[0]))) {
		return "", false
	}
	return to + rest, true
}

// rebaseAll lists the leaves under from, moved to to.
func rebaseAll(leaves []imageString, from, to string) []URLChange {
	var changes []URLChange
	for _, l := range leaves {
		if moved, ok := rebase(l.value, from, to); ok {
			changes = append(changes, URLChange{Field: l.field, From: l.value, To: moved})
		}
	}
	return changes
}

// rewrite returns content with each leaf under from moved to to, leaving
// every other byte as it was, so the commit's diff shows only the URLs.
func rewrite(content []byte, leaves []imageString, from, to string) []byte {
	var out bytes.Buffer
	last := 0
	for _, l := range leaves {
		moved, ok := rebase(l.value, from, to)
		if !ok {
			continue
		}
		out.Write(content[last:l.start])
		raw := content[l.start:l.end]
		// Keep the rest of the URL as it was escaped, when from is written as is.
		if rest, ok := bytes.CutPrefix(raw, []byte(`"`+from)); ok {
			out.WriteByte('"')
			out.Write(jsonStringBody(to))
			out.Write(rest)
		} else {
			out.WriteByte('"')
			out.Write(jsonStringBody(moved))
			out.WriteByte('"')
		}
		last = l.end
	}
	out.Write(content[last:])
	return out.Bytes()
}

// jsonStringBody is s as a JSON string, without its quotes.
func jsonStringBody(s string) []byte {
	b, _ := json.Marshal(s)
	return b[1 : len(b)-1]
}

// imageString is a string value under a photo's top-level "images", with the
// byte range of its JSON token, quotes included.
type imageString struct {
	field      string
	value      string
	start, end int
}

// jsonFrame is an object or array imageStrings is inside.
type jsonFrame struct {
	path    string
	object  bool
	wantKey bool
	key     string
	index   int
}

// imageStrings finds every string value under the top-level "images" of a
// photo's JSON, at any depth, in order.
func imageStrings(content []byte) ([]imageString, error) {
	dec := json.NewDecoder(bytes.NewReader(content))
	var stack []*jsonFrame
	var leaves []imageString
	prev := 0
	// valuePath is the path of the value about to be read in the top frame.
	valuePath := func() string {
		if len(stack) == 0 {
			return ""
		}
		top := stack[len(stack)-1]
		if top.object {
			top.wantKey = true
			if top.path == "" {
				return top.key
			}
			return top.path + "." + top.key
		}
		top.index++
		return fmt.Sprintf("%s[%d]", top.path, top.index-1)
	}
	for {
		tok, err := dec.Token()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, err
		}
		end := int(dec.InputOffset())
		start := prev
		prev = end

		switch tok := tok.(type) {
		case json.Delim:
			if tok == '{' || tok == '[' {
				stack = append(stack, &jsonFrame{path: valuePath(), object: tok == '{', wantKey: tok == '{'})
			} else {
				stack = stack[:len(stack)-1]
			}
			continue
		case string:
			if top := len(stack) - 1; top >= 0 && stack[top].object && stack[top].wantKey {
				stack[top].key, stack[top].wantKey = tok, false
				continue
			}
			field := valuePath()
			if strings.HasPrefix(field, "images.") || strings.HasPrefix(field, "images[") {
				// Before a token come only whitespace, commas and colons, so its
				// first quote starts it.
				start += bytes.IndexByte(content[start:end], '"')
				leaves = append(leaves, imageString{field: field, value: tok, start: start, end: end})
			}
		default:
			valuePath()
		}
	}
	return leaves, nil
}

// origins counts the image URLs of files by scheme and host, most used first.
func origins(files []photoFile) []ImageOrigin {
	byOrigin := map[string]*ImageOrigin{}
	for _, f := range files {
		seen := map[string]bool{}
		for _, l := range f.leaves {
			u, err := url.Parse(l.value)
			if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
				continue
			}
			origin := u.Scheme + "://" + u.Host
			o := byOrigin[origin]
			if o == nil {
				o = &ImageOrigin{Origin: origin}
				byOrigin[origin] = o
			}
			o.URLs++
			if !seen[origin] {
				seen[origin] = true
				o.Files++
			}
		}
	}
	out := []ImageOrigin{}
	for _, o := range byOrigin {
		out = append(out, *o)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].URLs != out[j].URLs {
			return out[i].URLs > out[j].URLs
		}
		return out[i].Origin < out[j].Origin
	})
	return out
}

// scanPhotos reads every photo file in gh's folder at the head of the open
// photo data pull request's branch, or of the base branch when none is open.
func (c *Client) scanPhotos(ctx context.Context, gh settings.GitHub) (baseURLScan, *PublishError) {
	folder, perr := photoFolder(gh.Folder)
	if perr != nil {
		return baseURLScan{}, perr
	}
	t, perr := c.target(ctx, gh)
	if perr != nil {
		return baseURLScan{}, perr
	}
	scan := baseURLScan{t: t, folder: folder, branch: t.base}
	if scan.pr, perr = c.findPullRequest(ctx, t); perr != nil {
		return baseURLScan{}, perr
	}
	if scan.pr != nil {
		scan.branch = scan.pr.Head.Ref
	}
	if scan.headSHA, perr = c.branchHead(ctx, t, scan.branch); perr != nil {
		return baseURLScan{}, perr
	}
	entries, perr := c.listFolder(ctx, t, folder, scan.headSHA)
	if perr != nil {
		return baseURLScan{}, perr
	}

	scan.files = make([]photoFile, len(entries))
	var wg sync.WaitGroup
	sem := make(chan struct{}, readConcurrency)
	for i, e := range entries {
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			scan.files[i] = c.readPhoto(ctx, t, e)
		}()
	}
	wg.Wait()
	return scan, nil
}

// folderEntry is the part of a GET /contents directory listing entry used.
type folderEntry struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	Type    string `json:"type"`
	SHA     string `json:"sha"`
	HTMLURL string `json:"html_url"`
}

// listFolder lists the photo JSON files directly in folder at ref, by path.
// GitHub lists up to 1,000 files in a folder.
func (c *Client) listFolder(ctx context.Context, t target, folder, ref string) ([]folderEntry, *PublishError) {
	var entries []folderEntry
	p := repoPath(t.owner, t.name) + "/contents/" + escapePath(folder) + "?ref=" + url.QueryEscape(ref)
	res, err := c.do(ctx, http.MethodGet, p, t.token, nil, &entries)
	if err == nil && res.Status == http.StatusNotFound {
		return nil, publishErr(http.StatusNotFound, "The folder %s wasn't found in %s.", folder, t.repo.FullName)
	}
	if perr := readCheck(res, err, "listing the photo data folder"); perr != nil {
		return nil, perr
	}
	var photos []folderEntry
	for _, e := range entries {
		if e.Type == "file" && strings.EqualFold(path.Ext(e.Name), ".json") && !skippedDataFiles[strings.ToLower(e.Name)] {
			photos = append(photos, e)
		}
	}
	sort.Slice(photos, func(i, j int) bool { return photos[i].Path < photos[j].Path })
	return photos, nil
}

// readPhoto reads the blob of e and finds its image URLs.
func (c *Client) readPhoto(ctx context.Context, t target, e folderEntry) photoFile {
	f := photoFile{path: e.Path, fileURL: e.HTMLURL}
	var blob struct {
		Content  string `json:"content"`
		Encoding string `json:"encoding"`
	}
	res, err := c.do(ctx, http.MethodGet, repoPath(t.owner, t.name)+"/git/blobs/"+url.PathEscape(e.SHA), t.token, nil, &blob)
	if perr := readCheck(res, err, "reading the file"); perr != nil {
		f.err = perr.Message
		return f
	}
	content, err := base64.StdEncoding.DecodeString(strings.ReplaceAll(blob.Content, "\n", ""))
	if blob.Encoding != "base64" || err != nil {
		f.err = "GitHub returned content that couldn't be decoded."
		return f
	}
	var fields map[string]json.RawMessage
	if json.Unmarshal(content, &fields) != nil || fields == nil {
		f.err = "The file isn't a JSON object."
		return f
	}
	leaves, err := imageStrings(content)
	if err != nil {
		f.err = "The file isn't valid JSON."
		return f
	}
	f.content, f.leaves = content, leaves
	return f
}

// branchHead returns the commit at the tip of branch.
func (c *Client) branchHead(ctx context.Context, t target, branch string) (string, *PublishError) {
	var ref struct {
		Object struct {
			SHA string `json:"sha"`
		} `json:"object"`
	}
	res, err := c.do(ctx, http.MethodGet, repoPath(t.owner, t.name)+"/git/ref/heads/"+escapePath(branch), t.token, nil, &ref)
	if err == nil && res.Status == http.StatusNotFound {
		return "", publishErr(http.StatusBadGateway, "Branch %q wasn't found in %s.", branch, t.repo.FullName)
	}
	if perr := readCheck(res, err, "looking up the branch"); perr != nil {
		return "", perr
	}
	return ref.Object.SHA, nil
}

// gitCommit is the part of a created commit used.
type gitCommit struct {
	SHA     string `json:"sha"`
	HTMLURL string `json:"html_url"`
	Tree    struct {
		SHA string `json:"sha"`
	} `json:"tree"`
}

// createCommit commits entries, Git tree entries with their content, on top
// of parent, without moving any branch. See
// https://docs.github.com/en/rest/git/trees#create-a-tree
func (c *Client) createCommit(ctx context.Context, t target, parent string, entries []map[string]string, message string) (gitCommit, *PublishError) {
	repo := repoPath(t.owner, t.name)
	var base gitCommit
	res, err := c.do(ctx, http.MethodGet, repo+"/git/commits/"+url.PathEscape(parent), t.token, nil, &base)
	if perr := readCheck(res, err, "reading the branch's head commit"); perr != nil {
		return gitCommit{}, perr
	}
	var tree struct {
		SHA string `json:"sha"`
	}
	res, err = c.do(ctx, http.MethodPost, repo+"/git/trees", t.token, map[string]any{"base_tree": base.Tree.SHA, "tree": entries}, &tree)
	if perr := check(res, err, "saving the changed files"); perr != nil {
		return gitCommit{}, perr
	}
	var commit gitCommit
	body := map[string]any{"message": message, "tree": tree.SHA, "parents": []string{parent}}
	res, err = c.do(ctx, http.MethodPost, repo+"/git/commits", t.token, body, &commit)
	if perr := check(res, err, "making the commit"); perr != nil {
		return gitCommit{}, perr
	}
	return commit, nil
}

// moveBranch fast-forwards branch to sha.
func (c *Client) moveBranch(ctx context.Context, t target, branch, sha string) *PublishError {
	body := map[string]any{"sha": sha, "force": false}
	res, err := c.do(ctx, http.MethodPatch, repoPath(t.owner, t.name)+"/git/refs/heads/"+escapePath(branch), t.token, body, nil)
	// GitHub answers 422 when the branch moved since it was read.
	if err == nil && (res.Status == http.StatusUnprocessableEntity || res.Status == http.StatusConflict) {
		return publishErr(http.StatusConflict, "%s changed while the files were being saved. Try again.", branch)
	}
	return check(res, err, "updating the branch")
}
