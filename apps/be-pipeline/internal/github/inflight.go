package github

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// DefaultDataFolder is where the portfolio keeps photo JSON, used by InFlight
// when Settings has no folder.
const DefaultDataFolder = "apps/portfolio/src/data"

// AllPhotosFile is the portfolio's combined photo list, which InFlight leaves
// out since it isn't one photo's data.
const AllPhotosFile = "ALLPHOTOS.json"

// maxPullRequestFiles is how many changed files GitHub lists for a pull request.
const maxPullRequestFiles = 3000

// InFlightPullRequest is the open photo data pull request.
type InFlightPullRequest struct {
	Number  int    `json:"number"`
	Title   string `json:"title"`
	URL     string `json:"url"`
	Branch  string `json:"branch"`
	HeadSHA string `json:"headSha"`
}

// InFlightFile is one photo JSON file in the pull request.
type InFlightFile struct {
	Path string `json:"path"`
	// Status is GitHub's change status: added, modified, renamed and so on.
	Status  string          `json:"status"`
	FileURL string          `json:"fileUrl"`
	Data    json.RawMessage `json:"data,omitempty"`
	// Error says why Data is missing, when it couldn't be read or parsed.
	Error string `json:"error,omitempty"`
}

// InFlightResult is the photo data waiting in the open pull request.
// PullRequest is nil when no pull request titled PullRequestTitle is open.
type InFlightResult struct {
	Repo        string               `json:"repo"`
	Folder      string               `json:"folder"`
	PullRequest *InFlightPullRequest `json:"pullRequest"`
	Files       []InFlightFile       `json:"files"`
}

// inFlightPull is the part of a listed pull request InFlight uses.
type inFlightPull struct {
	Number  int    `json:"number"`
	Title   string `json:"title"`
	HTMLURL string `json:"html_url"`
	Head    struct {
		Ref string `json:"ref"`
		SHA string `json:"sha"`
	} `json:"head"`
}

// pullFile is the part of GET /pulls/{n}/files InFlight uses.
type pullFile struct {
	Filename string `json:"filename"`
	Status   string `json:"status"`
	BlobURL  string `json:"blob_url"`
}

// InFlight finds the open pull request titled PullRequestTitle in gh's
// repository and reads the JSON files it changes in the data folder, except
// AllPhotosFile, at the pull request's head. It only reads from GitHub.
func (c *Client) InFlight(ctx context.Context, gh settings.GitHub) (InFlightResult, error) {
	folder, perr := dataFolder(gh.Folder)
	if perr != nil {
		return InFlightResult{}, perr
	}
	owner, name, ok := splitRepo(gh.Repo)
	if !ok || gh.Token == "" {
		return InFlightResult{}, publishErr(http.StatusBadRequest, "Set the GitHub repository and token in Settings first.")
	}
	t := target{owner: owner, name: name, token: gh.Token}
	result := InFlightResult{Repo: owner + "/" + name, Folder: folder, Files: []InFlightFile{}}

	pr, perr := c.findInFlightPull(ctx, t)
	if perr != nil {
		return InFlightResult{}, perr
	}
	if pr == nil {
		return result, nil
	}
	result.PullRequest = &InFlightPullRequest{
		Number: pr.Number, Title: pr.Title, URL: pr.HTMLURL, Branch: pr.Head.Ref, HeadSHA: pr.Head.SHA,
	}

	files, perr := c.listPullFiles(ctx, t, pr.Number)
	if perr != nil {
		return InFlightResult{}, perr
	}
	for _, f := range files {
		if f.Status == "removed" || !isPhotoData(folder, f.Filename) {
			continue
		}
		file := InFlightFile{Path: f.Filename, Status: f.Status, FileURL: f.BlobURL}
		file.Data, file.Error = c.readJSON(ctx, t, f.Filename, pr.Head.SHA)
		result.Files = append(result.Files, file)
	}
	return result, nil
}

// dataFolder cleans the Settings folder, defaulting to DefaultDataFolder.
func dataFolder(folder string) (string, *PublishError) {
	folder = strings.Trim(strings.TrimSpace(folder), "/")
	if folder == "" {
		return DefaultDataFolder, nil
	}
	for _, segment := range strings.Split(folder, "/") {
		if segment == "" || segment == "." || segment == ".." {
			return "", publishErr(http.StatusBadRequest, "The folder in Settings isn't a valid path.")
		}
	}
	return folder, nil
}

// isPhotoData reports a .json file directly in folder, other than AllPhotosFile.
func isPhotoData(folder, file string) bool {
	return path.Dir(file) == folder && strings.EqualFold(path.Ext(file), ".json") &&
		!strings.EqualFold(path.Base(file), AllPhotosFile)
}

// findInFlightPull returns the first open pull request titled
// PullRequestTitle, or nil when there is none.
func (c *Client) findInFlightPull(ctx context.Context, t target) (*inFlightPull, *PublishError) {
	for page := 1; ; page++ {
		query := url.Values{"state": {"open"}, "per_page": {"100"}, "page": {strconv.Itoa(page)}}
		var pulls []inFlightPull
		res, err := c.do(ctx, http.MethodGet, repoPath(t.owner, t.name)+"/pulls?"+query.Encode(), t.token, nil, &pulls)
		if perr := readCheck(res, err, "looking for the photo data pull request"); perr != nil {
			return nil, perr
		}
		for i, pr := range pulls {
			if strings.TrimSpace(pr.Title) == PullRequestTitle {
				return &pulls[i], nil
			}
		}
		if len(pulls) < 100 {
			return nil, nil
		}
	}
}

// listPullFiles lists the files pull request number changes, up to the
// maxPullRequestFiles GitHub returns.
func (c *Client) listPullFiles(ctx context.Context, t target, number int) ([]pullFile, *PublishError) {
	var all []pullFile
	for page := 1; len(all) < maxPullRequestFiles; page++ {
		query := url.Values{"per_page": {"100"}, "page": {strconv.Itoa(page)}}
		p := repoPath(t.owner, t.name) + "/pulls/" + strconv.Itoa(number) + "/files?" + query.Encode()
		var files []pullFile
		res, err := c.do(ctx, http.MethodGet, p, t.token, nil, &files)
		if perr := readCheck(res, err, "listing the pull request's files"); perr != nil {
			return nil, perr
		}
		all = append(all, files...)
		if len(files) < 100 {
			break
		}
	}
	return all, nil
}

// readJSON fetches file at ref and returns it as JSON, or a message saying why
// it couldn't.
func (c *Client) readJSON(ctx context.Context, t target, file, ref string) (json.RawMessage, string) {
	var out struct {
		Content  string `json:"content"`
		Encoding string `json:"encoding"`
	}
	p := repoPath(t.owner, t.name) + "/contents/" + escapePath(file) + "?ref=" + url.QueryEscape(ref)
	res, err := c.do(ctx, http.MethodGet, p, t.token, nil, &out)
	if perr := readCheck(res, err, "reading the file"); perr != nil {
		return nil, perr.Message
	}
	if out.Encoding != "base64" {
		return nil, "GitHub didn't return the file's content. It may be too large."
	}
	content, err := base64.StdEncoding.DecodeString(strings.ReplaceAll(out.Content, "\n", ""))
	if err != nil {
		return nil, "GitHub returned content that couldn't be decoded."
	}
	if !json.Valid(content) {
		return nil, "The file isn't valid JSON."
	}
	return json.RawMessage(content), ""
}

// readCheck is check for calls that only read, so a 403 or 404 asks for read
// access rather than write access.
func readCheck(res response, err error, doing string) *PublishError {
	if err == nil && (res.Status == http.StatusForbidden || res.Status == http.StatusNotFound) && !isRateLimited(res) {
		return publishErr(http.StatusBadGateway,
			"The token can't read this repository. Give it Contents and Pull requests read access.")
	}
	return check(res, err, doing)
}
