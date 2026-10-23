package github

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// RemovedFile is a photo JSON file Remove took out, with the photo it named
// so its image can be found.
type RemovedFile struct {
	Path string `json:"path"`
	// PhotoName, ImageURL and ImageKey are as in InFlightFile.
	PhotoName string `json:"photoName"`
	ImageURL  string `json:"imageUrl,omitempty"`
	ImageKey  string `json:"imageKey,omitempty"`
	// Before is the file's data before it was removed.
	Before json.RawMessage `json:"before"`
}

// Remove takes file out of the photo data waiting to be merged, in the
// pending changes: a file only saved so far is dropped, and one on the photo
// data pull request's branch is deleted there by the next Commit. Only photo
// JSON files that aren't on the base branch can be removed: deleting one that
// is would delete it from the portfolio when the pull request merges.
func (c *Client) Remove(ctx context.Context, gh settings.GitHub, file string) (RemovedFile, error) {
	folder, perr := photoFolder(gh.Folder)
	if perr != nil {
		return RemovedFile{}, perr
	}
	if perr := setUp(gh); perr != nil {
		return RemovedFile{}, perr
	}
	if !isPhotoData(folder, file) {
		return RemovedFile{}, publishErr(http.StatusBadRequest, "Only photo JSON files in %s can be removed.", folder)
	}
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return RemovedFile{}, perr
	}
	content, ok := w.file(file)
	switch {
	case w.onBase(file):
		return RemovedFile{}, publishErr(http.StatusConflict,
			"%s is already in the portfolio. Only new files can be removed here.", file)
	case !ok:
		return RemovedFile{}, publishErr(http.StatusNotFound, "%s isn't in the photo data pull request anymore. Refresh to see what is.", file)
	}
	removed := RemovedFile{Path: file, Before: json.RawMessage(content)}
	removed.PhotoName, removed.ImageURL, removed.ImageKey = photoRef(file, json.RawMessage(content))
	if perr := c.save(w, map[string][]byte{file: nil}); perr != nil {
		return RemovedFile{}, perr
	}
	return removed, nil
}
