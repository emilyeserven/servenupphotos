package github

import (
	"context"
	"net/http"
	"strings"
	"sync"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// PublishedStatus is the Status of every PublishedFile: the file is on the
// base branch, so it's already in the portfolio.
const PublishedStatus = "published"

// PublishedFile is one photo JSON file on the base branch.
type PublishedFile struct {
	InFlightFile
	// InFlight is GitHub's change status for the file in the open photo data
	// pull request, such as "modified" or "removed", or empty when the pull
	// request doesn't change it.
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

// Published reads every photo JSON file in gh's folder on the base branch,
// the photos already in the portfolio, sorted by path, and marks the ones the
// open photo data pull request changes. It only reads from GitHub.
func (c *Client) Published(ctx context.Context, gh settings.GitHub) (PublishedResult, error) {
	folder, perr := photoFolder(gh.Folder)
	if perr != nil {
		return PublishedResult{}, perr
	}
	t, perr := c.target(ctx, gh)
	if perr != nil {
		return PublishedResult{}, perr
	}
	result := PublishedResult{Repo: t.owner + "/" + t.name, Folder: folder, Branch: t.base, Files: []PublishedFile{}}

	inPull := map[string]string{}
	pr, perr := c.findInFlightPull(ctx, t)
	if perr != nil {
		return PublishedResult{}, perr
	}
	if pr != nil {
		result.PullRequest = &InFlightPullRequest{
			Number: pr.Number, Title: pr.Title, URL: pr.HTMLURL, Branch: pr.Head.Ref, HeadSHA: pr.Head.SHA,
		}
		files, perr := c.listPullFiles(ctx, t, pr.Number)
		if perr != nil {
			return PublishedResult{}, perr
		}
		for _, f := range files {
			inPull[f.Filename] = f.Status
		}
	}

	entries, perr := c.listJSON(ctx, t, folder, t.base, AllPhotosFile)
	if perr != nil {
		return PublishedResult{}, perr
	}
	for _, e := range entries {
		if skippedDataFiles[strings.ToLower(e.Name)] {
			continue
		}
		file := InFlightFile{Path: e.Path, Status: PublishedStatus, FileURL: e.HTMLURL}
		result.Files = append(result.Files, PublishedFile{InFlightFile: file, InFlight: inPull[e.Path]})
	}

	var wg sync.WaitGroup
	sem := make(chan struct{}, readConcurrency)
	for i := range result.Files {
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			f := &result.Files[i]
			f.Data, f.Error = c.readJSON(ctx, t, f.Path, t.base)
			f.PhotoName, f.ImageURL, f.ImageKey = photoRef(f.Path, f.Data)
		}()
	}
	wg.Wait()
	return result, nil
}

// updatePublished saves content over file, a photo JSON file on the base
// branch that the photo data pull request doesn't change yet, on branch, the
// pull request's branch, so the change goes into the pull request. With no
// branch, it makes one from the base branch and opens the pull request.
// A file already in the portfolio keeps its name, since renaming it would
// remove it from the base branch when the pull request merges.
func (c *Client) updatePublished(ctx context.Context, t target, branch, file, dest string, content []byte) (UpdatedFile, error) {
	if dest != file {
		return UpdatedFile{}, publishErr(http.StatusConflict,
			"%s is already in the portfolio, so it keeps its name.", file)
	}
	current, sha, found, msg := c.readFileSHA(ctx, t, file, t.base)
	if !found {
		return UpdatedFile{}, publishErr(http.StatusNotFound,
			"%s isn't in the photo data pull request or on %s. Refresh to see what is.", file, t.base)
	}
	if msg != "" {
		return UpdatedFile{}, publishErr(http.StatusBadGateway, "%s", msg)
	}
	if string(current) == string(content) {
		return UpdatedFile{Path: file}, nil
	}

	if branch == "" {
		branch = BranchPrefix + c.now().UTC().Format("2006-01-02-150405")
		if perr := c.createBranch(ctx, t, branch); perr != nil {
			return UpdatedFile{}, perr
		}
		updated, err := c.updateFile(ctx, t, file, sha, branch, content)
		if err != nil {
			return UpdatedFile{}, err
		}
		pr, perr := c.openPullRequest(ctx, t, branch)
		if perr != nil {
			return UpdatedFile{}, perr
		}
		updated.PullRequestURL, updated.NewPullRequest = pr.HTMLURL, true
		return updated, nil
	}

	// The branch may hold an older copy, or none when it was made before the
	// file reached the base branch.
	_, sha, found, msg = c.readFileSHA(ctx, t, file, branch)
	if !found {
		return UpdatedFile{}, publishErr(http.StatusConflict,
			"%s is on %s but not on the pull request's branch %s. Update the branch from %s, then try again.", file, t.base, branch, t.base)
	}
	if msg != "" {
		return UpdatedFile{}, publishErr(http.StatusBadGateway, "%s", msg)
	}
	return c.updateFile(ctx, t, file, sha, branch, content)
}
