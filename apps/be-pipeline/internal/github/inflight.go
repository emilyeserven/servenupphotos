package github

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/url"
	"path"
	"reflect"
	"strconv"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// DefaultDataFolder is where the portfolio keeps photo JSON, used by InFlight
// when Settings has no folder.
const DefaultDataFolder = "apps/portfolio/src/data"

// AllPhotosFile is the portfolio's combined photo list: a JSON array of every
// photo file in the data folder, rebuilt by CI on the pull request. InFlight
// lists it apart from the photo files and checks each photo against it.
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
	// PhotoName is the photo's original file name: Data's "file", or the
	// JSON file's name when Data has none.
	PhotoName string `json:"photoName"`
	// ImageURL and ImageKey are Data's "images.full" and "images.key", the
	// photo's R2 URL and key saved with it when it was uploaded before it was
	// saved.
	ImageURL string `json:"imageUrl,omitempty"`
	ImageKey string `json:"imageKey,omitempty"`
	// InAllPhotos says whether Data equals an entry of AllPhotosFile. It is
	// nil when either file couldn't be read.
	InAllPhotos *bool `json:"inAllPhotos"`
}

// InFlightAllPhotos is AllPhotosFile at the pull request's head.
type InFlightAllPhotos struct {
	Path string `json:"path"`
	// Found is false when the file isn't on the pull request's branch.
	Found bool `json:"found"`
	// FileURL is the file's page on GitHub, when the pull request changes it.
	FileURL string `json:"fileUrl,omitempty"`
	// Count is how many photos the file lists.
	Count int `json:"count"`
	// Data is the file's JSON array, as committed, when it could be read.
	Data json.RawMessage `json:"data,omitempty"`
	// Error says why the file couldn't be used, when it was found.
	Error string `json:"error,omitempty"`
}

// InFlightResult is the photo data waiting in the open pull request.
// PullRequest is nil when no pull request titled PullRequestTitle is open.
type InFlightResult struct {
	Repo        string               `json:"repo"`
	Folder      string               `json:"folder"`
	PullRequest *InFlightPullRequest `json:"pullRequest"`
	Files       []InFlightFile       `json:"files"`
	// AllPhotos is not Found when there is no pull request.
	AllPhotos InFlightAllPhotos `json:"allPhotos"`
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
	result := InFlightResult{
		Repo: owner + "/" + name, Folder: folder, Files: []InFlightFile{},
		AllPhotos: InFlightAllPhotos{Path: folder + "/" + AllPhotosFile},
	}

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
	allPhotosURL := ""
	for _, f := range files {
		if f.Filename == result.AllPhotos.Path {
			allPhotosURL = f.BlobURL
		}
		if f.Status == "removed" || !isPhotoData(folder, f.Filename) {
			continue
		}
		file := InFlightFile{Path: f.Filename, Status: f.Status, FileURL: f.BlobURL}
		file.Data, file.Error = c.readJSON(ctx, t, f.Filename, pr.Head.SHA)
		file.PhotoName, file.ImageURL, file.ImageKey = photoRef(f.Filename, file.Data)
		result.Files = append(result.Files, file)
	}

	var entries []any
	result.AllPhotos, entries = c.readAllPhotos(ctx, t, folder, pr.Head.SHA)
	result.AllPhotos.FileURL = allPhotosURL
	for i, file := range result.Files {
		if entries != nil && file.Data != nil {
			in := containsJSON(entries, file.Data)
			result.Files[i].InAllPhotos = &in
		}
	}
	return result, nil
}

// readAllPhotos reads AllPhotosFile in folder at ref and returns its entries.
func (c *Client) readAllPhotos(ctx context.Context, t target, folder, ref string) (InFlightAllPhotos, []any) {
	all := InFlightAllPhotos{Path: folder + "/" + AllPhotosFile}
	content, found, msg := c.readFile(ctx, t, all.Path, ref)
	all.Found = found
	if !found {
		return all, nil
	}
	if msg != "" {
		all.Error = msg
		return all, nil
	}
	entries := []any{}
	if err := json.Unmarshal(content, &entries); err != nil || entries == nil {
		all.Error = "The file isn't a JSON array."
		return all, nil
	}
	all.Count = len(entries)
	all.Data = json.RawMessage(content)
	return all, entries
}

// photoRef returns the "file" field of data, or file's name without .json,
// and data's "images.full" URL and "images.key", if any.
func photoRef(file string, data json.RawMessage) (name, imageURL, imageKey string) {
	var photo struct {
		File   string `json:"file"`
		Images struct {
			Full *string `json:"full"`
			Key  *string `json:"key"`
		} `json:"images"`
	}
	if json.Unmarshal(data, &photo) != nil {
		return strings.TrimSuffix(path.Base(file), path.Ext(file)), "", ""
	}
	name = strings.TrimSpace(photo.File)
	if name == "" {
		name = strings.TrimSuffix(path.Base(file), path.Ext(file))
	}
	if photo.Images.Full != nil {
		imageURL = strings.TrimSpace(*photo.Images.Full)
	}
	if photo.Images.Key != nil {
		imageKey = strings.TrimSpace(*photo.Images.Key)
	}
	return name, imageURL, imageKey
}

// containsJSON reports whether data equals one of entries, ignoring
// formatting and key order.
func containsJSON(entries []any, data json.RawMessage) bool {
	var v any
	if json.Unmarshal(data, &v) != nil {
		return false
	}
	for _, e := range entries {
		if reflect.DeepEqual(e, v) {
			return true
		}
	}
	return false
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
	content, _, msg := c.readFile(ctx, t, file, ref)
	if msg != "" {
		return nil, msg
	}
	if !json.Valid(content) {
		return nil, "The file isn't valid JSON."
	}
	return json.RawMessage(content), ""
}

// readFile fetches file at ref. found is false when GitHub has no such file;
// otherwise msg says why the content couldn't be read, if it couldn't.
func (c *Client) readFile(ctx context.Context, t target, file, ref string) (content []byte, found bool, msg string) {
	content, _, found, msg = c.readFileSHA(ctx, t, file, ref)
	return content, found, msg
}

// readFileSHA is readFile that also returns the file's blob SHA, which
// GitHub needs to change or delete it.
func (c *Client) readFileSHA(ctx context.Context, t target, file, ref string) (content []byte, sha string, found bool, msg string) {
	var out struct {
		Content  string `json:"content"`
		Encoding string `json:"encoding"`
		SHA      string `json:"sha"`
	}
	p := repoPath(t.owner, t.name) + "/contents/" + escapePath(file) + "?ref=" + url.QueryEscape(ref)
	res, err := c.do(ctx, http.MethodGet, p, t.token, nil, &out)
	if err == nil && res.Status == http.StatusNotFound {
		return nil, "", false, "The file wasn't found at the pull request's head."
	}
	if perr := readCheck(res, err, "reading the file"); perr != nil {
		return nil, "", true, perr.Message
	}
	if out.Encoding != "base64" {
		return nil, "", true, "GitHub didn't return the file's content. It may be too large."
	}
	content, err = base64.StdEncoding.DecodeString(strings.ReplaceAll(out.Content, "\n", ""))
	if err != nil {
		return nil, "", true, "GitHub returned content that couldn't be decoded."
	}
	return content, out.SHA, true, ""
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
