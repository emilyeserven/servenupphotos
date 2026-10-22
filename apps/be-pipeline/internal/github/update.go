package github

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// UpdatedFile is a photo JSON file Update changed.
type UpdatedFile struct {
	Path    string `json:"path"`
	FileURL string `json:"fileUrl"`
	// CommitSHA is the commit that changed the file, the pull request's new
	// head, so its CI runs can be found.
	CommitSHA string `json:"commitSha"`
	// Changed is false when data was already the file's content, so nothing
	// was committed and CommitSHA is empty.
	Changed bool `json:"changed"`
}

// Update replaces the content of file, a photo JSON file in the open pull
// request titled PullRequestTitle, with data, a JSON object, on the pull
// request's branch. Only files the pull request adds or modifies can be
// updated, so an edit never reaches past the photos in flight.
func (c *Client) Update(ctx context.Context, gh settings.GitHub, file string, data json.RawMessage) (UpdatedFile, error) {
	folder, perr := photoFolder(gh.Folder)
	if perr != nil {
		return UpdatedFile{}, perr
	}
	owner, name, ok := splitRepo(gh.Repo)
	if !ok || gh.Token == "" {
		return UpdatedFile{}, publishErr(http.StatusBadRequest, "Set the GitHub repository and token in Settings first.")
	}
	if !isPhotoData(folder, file) {
		return UpdatedFile{}, publishErr(http.StatusBadRequest, "Only photo JSON files in %s can be edited.", folder)
	}
	content, perr := photoContent(data)
	if perr != nil {
		return UpdatedFile{}, perr
	}
	t := target{owner: owner, name: name, token: gh.Token}

	pr, perr := c.findInFlightPull(ctx, t)
	if perr != nil {
		return UpdatedFile{}, perr
	}
	if pr == nil {
		return UpdatedFile{}, publishErr(http.StatusNotFound, "No pull request titled %q is open.", PullRequestTitle)
	}
	files, perr := c.listPullFiles(ctx, t, pr.Number)
	if perr != nil {
		return UpdatedFile{}, perr
	}
	changed, perr := checkEditable(files, file)
	if perr != nil {
		return UpdatedFile{}, perr
	}

	// Read at the branch, so the SHA sent with the change is the file's latest.
	current, sha, _, msg := c.readFileSHA(ctx, t, file, pr.Head.Ref)
	if msg != "" {
		return UpdatedFile{}, publishErr(http.StatusBadGateway, "%s", msg)
	}
	if bytes.Equal(current, content) {
		return UpdatedFile{Path: file, FileURL: changed.BlobURL}, nil
	}
	return c.updateFile(ctx, t, file, sha, pr.Head.Ref, content)
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

// checkEditable returns file as the pull request changes it, failing unless
// the pull request adds or modifies it.
func checkEditable(files []pullFile, file string) (pullFile, *PublishError) {
	for _, f := range files {
		if f.Filename != file {
			continue
		}
		if f.Status == "removed" {
			return pullFile{}, publishErr(http.StatusConflict, "%s is removed in the pull request, so it can't be edited.", file)
		}
		return f, nil
	}
	return pullFile{}, publishErr(http.StatusNotFound, "%s isn't in the photo data pull request anymore. Refresh to see what is.", file)
}

// updateFile commits content over file, whose blob is sha, on branch.
func (c *Client) updateFile(ctx context.Context, t target, file, sha, branch string, content []byte) (UpdatedFile, error) {
	body := map[string]string{
		"message": "Update photo data " + file,
		"content": base64.StdEncoding.EncodeToString(content),
		"sha":     sha,
		"branch":  branch,
	}
	var out struct {
		Content struct {
			HTMLURL string `json:"html_url"`
		} `json:"content"`
		Commit struct {
			SHA string `json:"sha"`
		} `json:"commit"`
	}
	res, err := c.do(ctx, http.MethodPut, repoPath(t.owner, t.name)+"/contents/"+escapePath(file), t.token, body, &out)
	// GitHub answers 409 or 422 when the file changed since it was read.
	if err == nil && (res.Status == http.StatusConflict || res.Status == http.StatusUnprocessableEntity) {
		return UpdatedFile{}, publishErr(http.StatusConflict, "%s changed on %s while it was being saved. Refresh and try again.", file, branch)
	}
	if perr := check(res, err, "saving the file"); perr != nil {
		return UpdatedFile{}, perr
	}
	return UpdatedFile{Path: file, FileURL: out.Content.HTMLURL, CommitSHA: out.Commit.SHA, Changed: true}, nil
}
