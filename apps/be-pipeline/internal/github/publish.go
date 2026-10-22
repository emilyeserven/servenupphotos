package github

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/exif"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// BranchPrefix starts the name of every branch Publish creates. Publish adds
// files to the open pull request from a branch with this prefix when there is
// one, and opens a new one otherwise.
const BranchPrefix = "photo-data/"

// PullRequestTitle is the title of every pull request Publish opens.
const PullRequestTitle = "Add photo data"

const pullRequestBody = "Photo data saved from the servenupphotos pipeline. " +
	"Each save adds one JSON file to this pull request until it is merged or closed."

// Photo is one photo's data to publish.
type Photo struct {
	// Name is the JSON file's name, with or without the .json extension.
	Name string `json:"name"`
	// File is the photo's original file name.
	File      string         `json:"file"`
	Sanitized exif.Sanitized `json:"sanitized"`
	// Albums and Tags are the IDs of the albums and tags to save the photo
	// in; none when they're left out.
	Albums []string `json:"albums,omitempty"`
	Tags   []string `json:"tags,omitempty"`
}

// photoJSON is the content of a published file. The title and comment come
// first, where they're easy to find and edit, hiding the embedded ones.
type photoJSON struct {
	Title   *string `json:"title"`
	Comment *string `json:"comment"`
	File    string  `json:"file"`
	exif.Sanitized
	// Albums and Tags are the IDs of the albums and tags the photo is in.
	Albums []string `json:"albums"`
	Tags   []string `json:"tags"`
}

// newPhotoJSON is the content of a new photo file. It is also the list of
// fields every photo file should have, with their defaults: Backfill adds
// the ones an older file is missing from newPhotoJSON("", exif.Sanitized{}).
// Give a new field its default here, such as an empty list rather than nil.
func newPhotoJSON(file string, s exif.Sanitized) photoJSON {
	return photoJSON{
		Title: s.Title, Comment: s.Comment, File: file, Sanitized: s, Albums: []string{}, Tags: []string{},
	}
}

// PublishResult says where a photo's JSON went.
type PublishResult struct {
	Path              string `json:"path"`
	FileURL           string `json:"fileUrl"`
	PullRequestURL    string `json:"pullRequestUrl"`
	PullRequestNumber int    `json:"pullRequestNumber"`
	// NewPullRequest is true when this save opened the pull request, and false
	// when it added to one that was already open.
	NewPullRequest bool `json:"newPullRequest"`
	// Data is the JSON saved, so pages can show it before CI rebuilds the
	// combined lists with it.
	Data json.RawMessage `json:"data"`
}

// PublishError is a failed publish, with a message fit to show and the HTTP
// status that best describes it.
type PublishError struct {
	Status  int
	Message string
}

func (e *PublishError) Error() string { return e.Message }

func publishErr(status int, format string, args ...any) *PublishError {
	return &PublishError{Status: status, Message: fmt.Sprintf(format, args...)}
}

// fileNamePattern allows plain file names only, so a name can't climb out of
// the folder or hide a file.
var fileNamePattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$`)

// pullRequest is the part of a GitHub pull request Publish uses.
type pullRequest struct {
	Number  int    `json:"number"`
	HTMLURL string `json:"html_url"`
	Head    struct {
		Ref  string `json:"ref"`
		Repo *struct {
			FullName string `json:"full_name"`
		} `json:"repo"`
	} `json:"head"`
}

// target is where a publish writes: one repository, base branch and folder.
type target struct {
	owner, name, token string
	repo               repoInfo
	base               string
}

// Publish saves photo as <folder>/photos/<name>.json on a photo-data/ branch
// and makes sure a pull request from that branch into gh's branch (or the
// default branch) is open. It never overwrites a file that already exists.
func (c *Client) Publish(ctx context.Context, gh settings.GitHub, photo Photo) (PublishResult, error) {
	folder, perr := photoFolder(gh.Folder)
	if perr != nil {
		return PublishResult{}, perr
	}
	path, perr := filePath(folder, photo.Name)
	if perr != nil {
		return PublishResult{}, perr
	}
	t, perr := c.target(ctx, gh)
	if perr != nil {
		return PublishResult{}, perr
	}
	data := newPhotoJSON(photo.File, photo.Sanitized)
	data.Albums, data.Tags = appendMissing(data.Albums, photo.Albums), appendMissing(data.Tags, photo.Tags)
	content, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return PublishResult{}, publishErr(http.StatusInternalServerError, "Couldn't encode the photo data.")
	}
	open, perr := c.findPullRequest(ctx, t)
	if perr != nil {
		return PublishResult{}, perr
	}
	return c.saveNewFile(ctx, t, open, path, append(content, '\n'), "Add photo data "+path)
}

// saveNewFile commits content as path on the branch of open, the open photo
// data pull request, or on a new photo-data/ branch with a new pull request
// when open is nil. It fails when path is already on the base branch or the
// pull request's branch.
func (c *Client) saveNewFile(ctx context.Context, t target, open *pullRequest, path string, content []byte, message string) (PublishResult, error) {
	if perr := c.ensureAbsent(ctx, t, path, t.base); perr != nil {
		return PublishResult{}, perr
	}
	branch := ""
	if open != nil {
		branch = open.Head.Ref
		if perr := c.ensureAbsent(ctx, t, path, branch); perr != nil {
			return PublishResult{}, perr
		}
	} else {
		branch = BranchPrefix + c.now().UTC().Format("2006-01-02-150405")
		if perr := c.createBranch(ctx, t, branch); perr != nil {
			return PublishResult{}, perr
		}
	}

	fileURL, perr := c.createFile(ctx, t, path, branch, content, message)
	if perr != nil {
		return PublishResult{}, perr
	}

	result := PublishResult{Path: path, FileURL: fileURL, Data: json.RawMessage(content)}
	if open == nil {
		if open, perr = c.openPullRequest(ctx, t, branch); perr != nil {
			return PublishResult{}, perr
		}
		result.NewPullRequest = true
	}
	result.PullRequestURL = open.HTMLURL
	result.PullRequestNumber = open.Number
	return result, nil
}

func (c *Client) now() time.Time {
	if c.Now != nil {
		return c.Now()
	}
	return time.Now()
}

// filePath joins a cleaned folder and a file name into a repository path.
func filePath(folder, name string) (string, *PublishError) {
	name = strings.TrimSuffix(strings.TrimSpace(name), ".json")
	if !fileNamePattern.MatchString(name) {
		return "", publishErr(http.StatusBadRequest,
			"Use a file name of letters, numbers, dots, dashes and underscores.")
	}
	return folder + "/" + name + ".json", nil
}

// target resolves gh into the repository and base branch to publish to.
func (c *Client) target(ctx context.Context, gh settings.GitHub) (target, *PublishError) {
	owner, name, ok := splitRepo(gh.Repo)
	if !ok || gh.Token == "" {
		return target{}, publishErr(http.StatusBadRequest, "Set the GitHub repository and token in Settings first.")
	}
	repo, msg := c.getRepo(ctx, owner, name, gh.Token)
	if msg != "" {
		return target{}, publishErr(http.StatusBadGateway, "%s", msg)
	}
	base := strings.TrimSpace(gh.Branch)
	if base == "" {
		base = repo.DefaultBranch
	}
	return target{owner: owner, name: name, token: gh.Token, repo: repo, base: base}, nil
}

// findPullRequest returns the open pull request into the base branch from a
// photo-data/ branch in the same repository, or nil when there is none.
func (c *Client) findPullRequest(ctx context.Context, t target) (*pullRequest, *PublishError) {
	query := url.Values{"state": {"open"}, "base": {t.base}, "per_page": {"100"}}
	var pulls []pullRequest
	res, err := c.do(ctx, http.MethodGet, repoPath(t.owner, t.name)+"/pulls?"+query.Encode(), t.token, nil, &pulls)
	if perr := check(res, err, "looking for an open pull request"); perr != nil {
		return nil, perr
	}
	for i, pr := range pulls {
		sameRepo := pr.Head.Repo != nil && strings.EqualFold(pr.Head.Repo.FullName, t.repo.FullName)
		if sameRepo && strings.HasPrefix(pr.Head.Ref, BranchPrefix) {
			return &pulls[i], nil
		}
	}
	return nil, nil
}

// ensureAbsent fails when path already exists on branch, since editing an
// existing photo's data is not supported.
func (c *Client) ensureAbsent(ctx context.Context, t target, path, branch string) *PublishError {
	p := repoPath(t.owner, t.name) + "/contents/" + escapePath(path) + "?ref=" + url.QueryEscape(branch)
	res, err := c.do(ctx, http.MethodGet, p, t.token, nil, nil)
	if err == nil && res.Status == http.StatusOK {
		return publishErr(http.StatusConflict, "%s already exists on %s. Pick another file name.", path, branch)
	}
	if err == nil && res.Status == http.StatusNotFound {
		return nil
	}
	return check(res, err, "checking for an existing file")
}

// createBranch creates branch from the tip of the base branch.
func (c *Client) createBranch(ctx context.Context, t target, branch string) *PublishError {
	var ref struct {
		Object struct {
			SHA string `json:"sha"`
		} `json:"object"`
	}
	res, err := c.do(ctx, http.MethodGet, repoPath(t.owner, t.name)+"/git/ref/heads/"+escapePath(t.base), t.token, nil, &ref)
	if err == nil && res.Status == http.StatusNotFound {
		return publishErr(http.StatusBadGateway, "Branch %q wasn't found in %s.", t.base, t.repo.FullName)
	}
	if perr := check(res, err, "looking up the base branch"); perr != nil {
		return perr
	}
	body := map[string]string{"ref": "refs/heads/" + branch, "sha": ref.Object.SHA}
	res, err = c.do(ctx, http.MethodPost, repoPath(t.owner, t.name)+"/git/refs", t.token, body, nil)
	return check(res, err, "creating the branch")
}

// createFile commits content as a new file at path on branch and returns the
// file's URL on GitHub.
func (c *Client) createFile(ctx context.Context, t target, path, branch string, content []byte, message string) (string, *PublishError) {
	body := map[string]string{
		"message": message,
		"content": base64.StdEncoding.EncodeToString(content),
		"branch":  branch,
	}
	var out struct {
		Content struct {
			HTMLURL string `json:"html_url"`
		} `json:"content"`
	}
	res, err := c.do(ctx, http.MethodPut, repoPath(t.owner, t.name)+"/contents/"+escapePath(path), t.token, body, &out)
	// GitHub answers 422 when the file appeared since ensureAbsent looked.
	if err == nil && (res.Status == http.StatusUnprocessableEntity || res.Status == http.StatusConflict) {
		return "", publishErr(http.StatusConflict, "%s already exists on %s. Pick another file name.", path, branch)
	}
	if perr := check(res, err, "saving the file"); perr != nil {
		return "", perr
	}
	return out.Content.HTMLURL, nil
}

// openPullRequest opens a pull request from branch into the base branch.
func (c *Client) openPullRequest(ctx context.Context, t target, branch string) (*pullRequest, *PublishError) {
	body := map[string]string{"title": PullRequestTitle, "head": branch, "base": t.base, "body": pullRequestBody}
	var pr pullRequest
	res, err := c.do(ctx, http.MethodPost, repoPath(t.owner, t.name)+"/pulls", t.token, body, &pr)
	if perr := check(res, err, "opening the pull request"); perr != nil {
		return nil, perr
	}
	return &pr, nil
}

// check turns a failed GitHub call into a PublishError naming what was being
// done, and returns nil for a 2xx response.
func check(res response, err error, doing string) *PublishError {
	switch {
	case err != nil:
		return publishErr(http.StatusBadGateway, "Couldn't reach GitHub.")
	case res.Status >= 200 && res.Status < 300:
		return nil
	case res.Status == http.StatusUnauthorized:
		return publishErr(http.StatusBadGateway, "GitHub rejected the token. It may be wrong, expired or revoked.")
	case isRateLimited(res):
		return publishErr(http.StatusBadGateway, rateLimited)
	case res.Status == http.StatusForbidden || res.Status == http.StatusNotFound:
		return publishErr(http.StatusBadGateway,
			"The token can't write to this repository. Give it Contents and Pull requests read and write access.")
	default:
		return publishErr(http.StatusBadGateway, "GitHub responded %d when %s.", res.Status, doing)
	}
}
