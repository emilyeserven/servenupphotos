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

// DefaultDataFolder is where the portfolio keeps its data, used when Settings
// has no folder. Photo, album and tag JSON each have a subfolder of it.
const DefaultDataFolder = "apps/portfolio/src/data"

// PhotosFolder is the data folder's subfolder of photo JSON files.
const PhotosFolder = "photos"

// AllPhotosFile is the portfolio's combined photo list: a JSON array of every
// photo file in the photos folder, rebuilt on the pull request by CommitCombined. InFlight
// leaves it out of the photo files; Combined reads it.
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
	// BaseBranch is the branch the pull request merges into, which changed
	// files' Base is read from.
	BaseBranch string `json:"baseBranch"`
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
	BaseFile
}

// BaseFile is a changed file as it is on the pull request's base branch, so
// the page can show what the pull request changes. Both are empty for a file
// the pull request adds.
type BaseFile struct {
	// Base is the file's JSON on the base branch, at its old path when the
	// pull request renames it.
	Base json.RawMessage `json:"base,omitempty"`
	// BaseError says why Base is missing, when the file should be there.
	BaseError string `json:"baseError,omitempty"`
}

// InFlightAllPhotos is a combined list CommitCombined builds, such as AllPhotosFile, read
// at one ref.
type InFlightAllPhotos struct {
	Path string `json:"path"`
	// Found is false when the file isn't at the ref.
	Found bool `json:"found"`
	// FileURL is the file's page on GitHub, when it was found.
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
// The combined lists aren't read here; Combined reads them.
type InFlightResult struct {
	Repo        string               `json:"repo"`
	Folder      string               `json:"folder"`
	PullRequest *InFlightPullRequest `json:"pullRequest"`
	Files       []InFlightFile       `json:"files"`
	// Albums, Tags, Places and Localizations are the album, tag, place and
	// localization files in the pull request.
	Albums        InFlightGroups `json:"albums"`
	Tags          InFlightGroups `json:"tags"`
	Places        InFlightGroups `json:"places"`
	Localizations InFlightGroups `json:"localizations"`
}

// groups are r's album, tag, place and localization files.
func (r *InFlightResult) groups() []*InFlightGroups {
	return []*InFlightGroups{&r.Albums, &r.Tags, &r.Places, &r.Localizations}
}

// InFlightGroups is the files of one Kind in the pull request.
type InFlightGroups struct {
	Folder string              `json:"folder"`
	Files  []InFlightGroupFile `json:"files"`
	// allFile is the kind's AllFile, which isn't listed.
	allFile string
}

// InFlightGroupFile is one album or tag file in the pull request.
type InFlightGroupFile struct {
	Path    string          `json:"path"`
	Status  string          `json:"status"`
	FileURL string          `json:"fileUrl"`
	Data    json.RawMessage `json:"data,omitempty"`
	Error   string          `json:"error,omitempty"`
	BaseFile
	// basePath is the file's path on the base branch, or "" when the pull
	// request adds it.
	basePath string
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
	Base struct {
		Ref string `json:"ref"`
	} `json:"base"`
}

// pullFile is the part of GET /pulls/{n}/files InFlight uses.
type pullFile struct {
	Filename string `json:"filename"`
	Status   string `json:"status"`
	BlobURL  string `json:"blob_url"`
	// PreviousFilename is the file's old path, when Status is "renamed".
	PreviousFilename string `json:"previous_filename"`
}

// basePath is f's path on the pull request's base branch, or "" when the
// pull request adds it.
func (f pullFile) basePath() string {
	switch f.Status {
	case "added", "copied", "removed":
		return ""
	case "renamed":
		return f.PreviousFilename
	default:
		return f.Filename
	}
}

// InFlight finds the open pull request titled PullRequestTitle in gh's
// repository and reads the JSON files it changes in the data folder, except
// the combined lists, at the pull request's head. It only reads
// from GitHub.
func (c *Client) InFlight(ctx context.Context, gh settings.GitHub) (InFlightResult, error) {
	root, perr := dataFolder(gh.Folder)
	if perr != nil {
		return InFlightResult{}, perr
	}
	folder := root + "/" + PhotosFolder
	owner, name, ok := splitRepo(gh.Repo)
	if !ok || gh.Token == "" {
		return InFlightResult{}, publishErr(http.StatusBadRequest, "Set the GitHub repository and token in Settings first.")
	}
	t := target{owner: owner, name: name, token: gh.Token}
	result := InFlightResult{
		Repo: owner + "/" + name, Folder: folder, Files: []InFlightFile{},
		Albums:        newInFlightGroups(root, Albums),
		Tags:          newInFlightGroups(root, Tags),
		Places:        newInFlightGroups(root, Kind{Folder: Places.Folder, AllFile: Places.AllFile}),
		Localizations: newInFlightGroups(root, Kind{Folder: Localizations.Folder, AllFile: Localizations.AllFile}),
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
		BaseBranch: pr.Base.Ref,
	}

	files, perr := c.listPullFiles(ctx, t, pr.Number)
	if perr != nil {
		return InFlightResult{}, perr
	}
	for _, f := range files {
		for _, g := range result.groups() {
			g.add(f)
		}
		if f.Status == "removed" || !isPhotoData(folder, f.Filename) {
			continue
		}
		file := InFlightFile{Path: f.Filename, Status: f.Status, FileURL: f.BlobURL}
		file.Data, file.Error = c.readJSON(ctx, t, f.Filename, pr.Head.SHA)
		file.PhotoName, file.ImageURL, file.ImageKey = photoRef(f.Filename, file.Data)
		file.BaseFile = c.readBase(ctx, t, f.basePath(), pr.Base.Ref)
		result.Files = append(result.Files, file)
	}
	for _, g := range result.groups() {
		c.readInFlightGroups(ctx, t, g, pr.Head.SHA, pr.Base.Ref)
	}
	return result, nil
}

func newInFlightGroups(root string, kind Kind) InFlightGroups {
	folder := root + "/" + kind.Folder
	return InFlightGroups{Folder: folder, Files: []InFlightGroupFile{}, allFile: folder + "/" + kind.AllFile}
}

// add lists f when it is a JSON file in g's folder the pull request doesn't
// remove, other than g's AllFile.
func (g *InFlightGroups) add(f pullFile) {
	if f.Filename == g.allFile {
		return
	}
	if f.Status == "removed" || path.Dir(f.Filename) != g.Folder || !strings.EqualFold(path.Ext(f.Filename), ".json") {
		return
	}
	g.Files = append(g.Files, InFlightGroupFile{Path: f.Filename, Status: f.Status, FileURL: f.BlobURL, basePath: f.basePath()})
}

// readInFlightGroups reads g's files at ref, and the ones the pull request
// changes at base too.
func (c *Client) readInFlightGroups(ctx context.Context, t target, g *InFlightGroups, ref, base string) {
	for i := range g.Files {
		g.Files[i].Data, g.Files[i].Error = c.readJSON(ctx, t, g.Files[i].Path, ref)
		g.Files[i].BaseFile = c.readBase(ctx, t, g.Files[i].basePath, base)
	}
}

// readBase reads file at the base branch base, or returns nothing when file
// is "", for a file the pull request adds.
func (c *Client) readBase(ctx context.Context, t target, file, base string) BaseFile {
	if file == "" || base == "" {
		return BaseFile{}
	}
	content, found, msg := c.readFile(ctx, t, file, base)
	switch {
	case !found:
		return BaseFile{BaseError: "The file isn't on " + base + "."}
	case msg != "":
		return BaseFile{BaseError: msg}
	case !json.Valid(content):
		return BaseFile{BaseError: "The file on " + base + " isn't valid JSON."}
	}
	return BaseFile{Base: json.RawMessage(content)}
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

// photoFolder is the photos folder in the Settings data folder.
func photoFolder(folder string) (string, *PublishError) {
	root, perr := dataFolder(folder)
	if perr != nil {
		return "", perr
	}
	return root + "/" + PhotosFolder, nil
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
