package github

import (
	"context"
	"fmt"
	"maps"
	"net/http"
	"net/url"
	"slices"
	"strings"
)

// catchUp is how Commit brings the base branch into a photo data pull
// request that has fallen behind it, so the pull request never conflicts
// with it: the commit is a merge of the base branch's head, made from the
// base branch's files with the pull request's own changes over them, and the
// combined lists rebuilt from the result.
//
// > Frontend analogy: like rebasing a feature branch before opening it for
// review, except the combined lists are rebuilt rather than merged by hand.
type catchUp struct {
	// baseHead is the base branch's head, the merge's second parent.
	baseHead string
	// carried are the pull request's own data file changes (nil content
	// deletes), which the commit's tree adds over the base branch's.
	carried map[string][]byte
}

// prFilesPages is how many pages of a pull request's files are read, 100 to
// a page: GitHub lists at most 3,000.
const prFilesPages = 30

// catchUp makes w's head the open photo data pull request with the base
// branch merged in, when the base branch has commits the pull request doesn't.
// The pull request's version of a data file wins when both changed it. It
// makes 1 GitHub call, plus 1 for each 100 files the pull request changes
// when it's behind.
func (c *Client) catchUp(ctx context.Context, w *workspace) *PublishError {
	if w.pr == nil || w.pr.Head.SHA == w.baseHead {
		return nil
	}
	behind, perr := c.behindBy(ctx, w)
	if perr != nil || behind == 0 {
		return perr
	}
	changed, perr := c.pullFiles(ctx, w)
	if perr != nil {
		return perr
	}
	merged := &snapshot{commit: w.head.commit, tree: w.base.tree, files: maps.Clone(w.base.files)}
	carried := map[string][]byte{}
	for _, p := range changed {
		if !strings.HasPrefix(p, w.root+"/") || isCombinedFile(p) {
			continue
		}
		f, ok := w.head.files[p]
		b, onBase := w.base.files[p]
		if ok == onBase && f.sha == b.sha {
			continue
		}
		delete(merged.files, p)
		if ok {
			merged.files[p] = f
		}
		if ok || onBase {
			carried[p] = f.content
		}
	}
	w.head, w.catchUp = merged, &catchUp{baseHead: w.baseHead, carried: carried}
	return nil
}

// behindBy is how many commits the base branch has that the pull request
// doesn't.
func (c *Client) behindBy(ctx context.Context, w *workspace) (int, *PublishError) {
	var compare struct {
		AheadBy int `json:"ahead_by"`
	}
	path := fmt.Sprintf("%s/compare/%s...%s?per_page=1", repoPath(w.t.owner, w.t.name),
		url.PathEscape(w.pr.Head.SHA), url.PathEscape(w.baseHead))
	res, err := c.do(ctx, http.MethodGet, path, w.t.token, nil, &compare)
	if perr := readCheck(res, err, "comparing the photo data pull request with its base branch"); perr != nil {
		return 0, perr
	}
	return compare.AheadBy, nil
}

// pullFiles are the paths the pull request adds, changes, deletes or renames
// (both names), against where it left the base branch.
func (c *Client) pullFiles(ctx context.Context, w *workspace) ([]string, *PublishError) {
	var out []string
	for page := 1; page <= prFilesPages; page++ {
		var files []struct {
			Filename         string `json:"filename"`
			PreviousFilename string `json:"previous_filename"`
		}
		path := fmt.Sprintf("%s/pulls/%d/files?per_page=100&page=%d", repoPath(w.t.owner, w.t.name), w.pr.Number, page)
		res, err := c.do(ctx, http.MethodGet, path, w.t.token, nil, &files)
		if perr := readCheck(res, err, "reading the photo data pull request's files"); perr != nil {
			return nil, perr
		}
		for _, f := range files {
			out = append(out, f.Filename)
			if f.PreviousFilename != "" {
				out = append(out, f.PreviousFilename)
			}
		}
		if len(files) < 100 {
			break
		}
	}
	return out, nil
}

// treeEntries are the entries of a commit's tree that writes paths of
// changes (nil content deletes), and, when w catches up, the pull request's
// own changes the paths don't already cover.
func (w *workspace) treeEntries(paths []string, changes map[string][]byte) []map[string]any {
	all := map[string][]byte{}
	if w.catchUp != nil {
		maps.Copy(all, w.catchUp.carried)
	}
	for _, p := range paths {
		all[p] = changes[p]
	}
	entries := make([]map[string]any, 0, len(all))
	for _, p := range slices.Sorted(maps.Keys(all)) {
		entry := map[string]any{"path": p, "mode": "100644", "type": "blob", "sha": nil}
		if content := all[p]; content != nil {
			delete(entry, "sha")
			entry["content"] = string(content)
		}
		entries = append(entries, entry)
	}
	return entries
}

// parents are a commit's parents: w's head, and the base branch's head when
// w catches up.
func (w *workspace) parents() []string {
	if w.catchUp != nil {
		return []string{w.head.commit, w.catchUp.baseHead}
	}
	return []string{w.head.commit}
}
