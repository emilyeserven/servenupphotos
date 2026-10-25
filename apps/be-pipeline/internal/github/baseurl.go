package github

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"sort"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

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

// BaseURLResult says where a base URL change was saved: in the pending
// changes, for the next Commit.
type BaseURLResult struct {
	pendingSave
	Files int `json:"files"`
	URLs  int `json:"urls"`
}

// photoFile is a photo JSON file read for a base URL change.
type photoFile struct {
	path, fileURL string
	content       []byte
	leaves        []imageString
	err           string
}

// baseURLScan is every photo file as the next Commit will have it.
type baseURLScan struct {
	w      *workspace
	t      target
	folder string
	// branch is where the next Commit commits, as workspace.branch says.
	branch string
	pr     *inFlightPull
	files  []photoFile
}

// PreviewBaseURL reads every photo JSON file in gh's folder, as the next
// Commit will have it, and reports the origins of their image URLs, and, when
// from and to are given, which URLs moving the images from base URL from to
// base URL to would rewrite. Photos in flight and pending changes are
// included. It changes nothing.
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
// base URL to instead, in all the photo JSON files PreviewBaseURL reads, in
// the pending changes. Nothing is saved when any photo file can't be read.
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

	if result.pendingSave, perr = c.saveScan(scan, entries); perr != nil {
		return BaseURLResult{}, perr
	}
	return result, nil
}

// saveScan saves entries, each a file's "path" and new "content", in the
// pending changes, with the content scan read as each one's before.
func (c *Client) saveScan(scan baseURLScan, entries []map[string]string) (pendingSave, *PublishError) {
	before := map[string][]byte{}
	for _, f := range scan.files {
		before[f.path] = f.content
	}
	changes := make([]ScanChange, 0, len(entries))
	for _, e := range entries {
		changes = append(changes, ScanChange{Path: e["path"], Before: before[e["path"]], After: json.RawMessage(e["content"])})
	}
	return c.saveFiles(scan.w, changes)
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

// scanPhotos reads every photo file in gh's folder as the next Commit will
// have it: at the open photo data pull request's head, or the base branch's
// when none is open, with the pending changes.
func (c *Client) scanPhotos(ctx context.Context, gh settings.GitHub) (baseURLScan, *PublishError) {
	folder, perr := photoFolder(gh.Folder)
	if perr != nil {
		return baseURLScan{}, perr
	}
	reportProgress(ctx, ProgressGitHub, 0, 0)
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return baseURLScan{}, perr
	}
	scan := baseURLScan{w: w, t: w.t, folder: folder, branch: w.branch(), pr: w.pr}
	for _, p := range w.paths(folder, AllPhotosFile) {
		if !skippedDataFiles[strings.ToLower(path.Base(p))] {
			scan.files = append(scan.files, w.readPhoto(p))
		}
	}
	return scan, nil
}

// readPhoto reads the photo file at p and finds its image URLs.
func (w *workspace) readPhoto(p string) photoFile {
	f := photoFile{path: p, fileURL: w.fileURL(p)}
	if f.err = w.readErr(p); f.err != "" {
		return f
	}
	content, _ := w.file(p)
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
