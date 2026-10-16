package github

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// RemovedFile is a photo JSON file Remove deleted, with the photo it named so
// its image can be found.
type RemovedFile struct {
	Path string `json:"path"`
	// PhotoName, ImageURL and ImageKey are as in InFlightFile.
	PhotoName string `json:"photoName"`
	ImageURL  string `json:"imageUrl,omitempty"`
	ImageKey  string `json:"imageKey,omitempty"`
}

// Remove deletes file from the branch of the open pull request titled
// PullRequestTitle. Only photo JSON files the pull request adds can be
// removed: deleting one that is also on the base branch would delete it from
// the portfolio when the pull request merges.
func (c *Client) Remove(ctx context.Context, gh settings.GitHub, file string) (RemovedFile, error) {
	folder, perr := dataFolder(gh.Folder)
	if perr != nil {
		return RemovedFile{}, perr
	}
	owner, name, ok := splitRepo(gh.Repo)
	if !ok || gh.Token == "" {
		return RemovedFile{}, publishErr(http.StatusBadRequest, "Set the GitHub repository and token in Settings first.")
	}
	if !isPhotoData(folder, file) {
		return RemovedFile{}, publishErr(http.StatusBadRequest, "Only photo JSON files in %s can be removed.", folder)
	}
	t := target{owner: owner, name: name, token: gh.Token}

	pr, perr := c.findInFlightPull(ctx, t)
	if perr != nil {
		return RemovedFile{}, perr
	}
	if pr == nil {
		return RemovedFile{}, publishErr(http.StatusNotFound, "No pull request titled %q is open.", PullRequestTitle)
	}
	files, perr := c.listPullFiles(ctx, t, pr.Number)
	if perr != nil {
		return RemovedFile{}, perr
	}
	if perr := checkRemovable(files, file); perr != nil {
		return RemovedFile{}, perr
	}

	// Read at the branch rather than the head SHA InFlight saw, so the SHA
	// sent with the delete is the file's latest.
	content, sha, _, msg := c.readFileSHA(ctx, t, file, pr.Head.Ref)
	if msg != "" {
		return RemovedFile{}, publishErr(http.StatusBadGateway, "%s", msg)
	}
	removed := RemovedFile{Path: file}
	removed.PhotoName, removed.ImageURL, removed.ImageKey = photoRef(file, json.RawMessage(content))

	if perr := c.deleteFile(ctx, t, file, sha, pr.Head.Ref); perr != nil {
		return RemovedFile{}, perr
	}
	return removed, nil
}

// checkRemovable fails unless the pull request's files add file.
func checkRemovable(files []pullFile, file string) *PublishError {
	for _, f := range files {
		if f.Filename != file {
			continue
		}
		if f.Status != "added" {
			return publishErr(http.StatusConflict,
				"%s is %s in the pull request, not added, so it's already in the portfolio. Only new files can be removed here.", file, f.Status)
		}
		return nil
	}
	return publishErr(http.StatusNotFound, "%s isn't in the photo data pull request anymore. Refresh to see what is.", file)
}

// deleteFile commits the deletion of file, whose blob is sha, to branch.
func (c *Client) deleteFile(ctx context.Context, t target, file, sha, branch string) *PublishError {
	body := map[string]string{"message": "Remove photo data " + file, "sha": sha, "branch": branch}
	p := repoPath(t.owner, t.name) + "/contents/" + escapePath(file)
	res, err := c.do(ctx, http.MethodDelete, p, t.token, body, nil)
	// GitHub answers 409 or 422 when the file changed since it was read.
	if err == nil && (res.Status == http.StatusConflict || res.Status == http.StatusUnprocessableEntity) {
		return publishErr(http.StatusConflict, "%s changed on %s while it was being removed. Refresh and try again.", file, branch)
	}
	return check(res, err, "removing the file")
}
