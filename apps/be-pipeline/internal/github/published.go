package github

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// PublishedStatus is the Status of every PublishedFile: the file is on the
// base branch, so it's already in the portfolio.
const PublishedStatus = "published"

// PublishedFile is one photo JSON file on the base branch.
type PublishedFile struct {
	InFlightFile
	// InFlight is how the photo data waiting to be merged (the open photo
	// data pull request and the pending changes) changes the file, "modified"
	// or "removed", or empty when it doesn't.
	InFlight string `json:"inFlight,omitempty"`
}

// PublishedResult is every photo JSON file on the base branch.
type PublishedResult struct {
	Repo   string `json:"repo"`
	Folder string `json:"folder"`
	Branch string `json:"branch"`
	// PullRequest is the open photo data pull request, or nil when none is.
	PullRequest *InFlightPullRequest `json:"pullRequest"`
	Files       []PublishedFile      `json:"files"`
}

// Published lists every photo JSON file in gh's folder on the base branch,
// the photos already in the portfolio, sorted by path, and marks the ones the
// photo data waiting to be merged changes.
func (c *Client) Published(ctx context.Context, gh settings.GitHub) (PublishedResult, error) {
	folder, perr := photoFolder(gh.Folder)
	if perr != nil {
		return PublishedResult{}, perr
	}
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return PublishedResult{}, perr
	}
	result := PublishedResult{
		Repo: w.t.repo.FullName, Folder: folder, Branch: w.t.base, PullRequest: w.inFlightPullRequest(),
		Files: []PublishedFile{},
	}
	for _, p := range w.basePaths(folder, AllPhotosFile) {
		if skippedDataFiles[strings.ToLower(p[len(folder)+1:])] {
			continue
		}
		file := InFlightFile{Path: p, Status: PublishedStatus, FileURL: blobURL(w.t, w.t.base, p)}
		f := w.base.files[p]
		if file.Error = f.err; file.Error == "" && !json.Valid(f.content) {
			file.Error = "The file isn't valid JSON."
		}
		if file.Error == "" {
			file.Data = json.RawMessage(f.content)
		}
		file.PhotoName, file.ImageURL, file.ImageKey = photoRef(p, file.Data)
		result.Files = append(result.Files, PublishedFile{InFlightFile: file, InFlight: w.status(p)})
	}
	return result, nil
}

// basePaths lists the .json files directly in folder on the base branch,
// except skip, sorted by path.
func (w *workspace) basePaths(folder, skip string) []string {
	var out []string
	for p := range w.base.files {
		if isDataFile(folder, p, skip) {
			out = append(out, p)
		}
	}
	sortPaths(out)
	return out
}
