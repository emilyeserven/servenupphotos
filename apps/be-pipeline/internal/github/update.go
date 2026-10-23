package github

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"path"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// UpdatedFile is a photo JSON file Update saved in the pending changes.
type UpdatedFile struct {
	Path string `json:"path"`
	// Changed is false when data was already the file's content, so nothing
	// was saved.
	Changed bool `json:"changed"`
	// PullRequestURL is the open photo data pull request the next Commit
	// commits to; empty when none is open and Commit will open one.
	PullRequestURL string `json:"pullRequestUrl,omitempty"`
	// Before is the file's data before the save, at its old path when it was
	// renamed.
	Before json.RawMessage `json:"before"`
	// Data is the file's data as saved.
	Data json.RawMessage `json:"data"`
}

// Update replaces the content of file, a photo JSON file in flight or already
// in the portfolio, with data, a JSON object, in the pending changes, for the
// next Commit. A file the photo data pull request removes can't be updated.
//
// When newName, a file name with or without the .json extension, differs from
// file's, the file is moved to it in the same folder. Only files that aren't
// on the base branch can be renamed, since renaming one that is would remove
// it there when the pull request merges.
func (c *Client) Update(ctx context.Context, gh settings.GitHub, file, newName string, data json.RawMessage) (UpdatedFile, error) {
	folder, perr := photoFolder(gh.Folder)
	if perr != nil {
		return UpdatedFile{}, perr
	}
	if perr := setUp(gh); perr != nil {
		return UpdatedFile{}, perr
	}
	if !isPhotoData(folder, file) {
		return UpdatedFile{}, publishErr(http.StatusBadRequest, "Only photo JSON files in %s can be edited.", folder)
	}
	content, perr := photoContent(data)
	if perr != nil {
		return UpdatedFile{}, perr
	}
	dest, perr := renamedPath(file, newName)
	if perr != nil {
		return UpdatedFile{}, perr
	}
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return UpdatedFile{}, perr
	}
	current, perr := w.editable(file)
	if perr != nil {
		return UpdatedFile{}, perr
	}
	result := UpdatedFile{Path: dest, Before: json.RawMessage(current), Data: json.RawMessage(content)}
	if w.pr != nil {
		result.PullRequestURL = w.pr.HTMLURL
	}
	changes := map[string][]byte{dest: content}
	if dest != file {
		if perr := w.renamable(file, dest); perr != nil {
			return UpdatedFile{}, perr
		}
		changes[file] = nil
	} else if bytes.Equal(current, content) {
		return result, nil
	}
	if perr := c.save(w, changes); perr != nil {
		return UpdatedFile{}, perr
	}
	result.Changed = true
	return result, nil
}

// editable returns file's content, failing when it isn't there or the photo
// data pull request removes it.
func (w *workspace) editable(file string) ([]byte, *PublishError) {
	if msg := w.readErr(file); msg != "" {
		return nil, publishErr(http.StatusBadGateway, "%s", msg)
	}
	current, ok := w.file(file)
	switch {
	case ok:
		return current, nil
	case w.onBase(file):
		return nil, publishErr(http.StatusConflict, "%s is removed in the pull request, so it can't be edited.", file)
	}
	return nil, publishErr(http.StatusNotFound,
		"%s isn't in the photo data pull request or on %s. Refresh to see what is.", file, w.t.base)
}

// renamable fails unless file can move to dest: it isn't in the portfolio
// yet, and dest isn't taken.
func (w *workspace) renamable(file, dest string) *PublishError {
	if w.onBase(file) {
		return publishErr(http.StatusConflict, "%s is already in the portfolio, so it keeps its name.", file)
	}
	return w.ensureAbsent(dest)
}

// renamedPath is file moved to name in the same folder, or file itself when
// name is empty.
func renamedPath(file, name string) (string, *PublishError) {
	name = strings.TrimSuffix(strings.TrimSpace(name), ".json")
	if name == "" {
		return file, nil
	}
	if !fileNamePattern.MatchString(name) {
		return "", publishErr(http.StatusBadRequest,
			"Use a file name of letters, numbers, dots, dashes and underscores.")
	}
	return path.Join(path.Dir(file), name+".json"), nil
}

// photoContent is data indented as Publish writes a photo's file, or an error
// when data isn't a JSON object.
func photoContent(data json.RawMessage) ([]byte, *PublishError) {
	var fields map[string]json.RawMessage
	if json.Unmarshal(data, &fields) != nil || fields == nil {
		return nil, publishErr(http.StatusBadRequest, "The photo data must be a JSON object.")
	}
	var out bytes.Buffer
	if err := json.Indent(&out, bytes.TrimSpace(data), "", "  "); err != nil {
		return nil, publishErr(http.StatusBadRequest, "The photo data must be a JSON object.")
	}
	out.WriteByte('\n')
	return out.Bytes(), nil
}
