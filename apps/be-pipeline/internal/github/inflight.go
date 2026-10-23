package github

import (
	"context"
	"encoding/json"
	"net/http"
	"path"
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

// InFlightFile is one photo JSON file the photo data pull request, with the
// pending changes, adds or changes.
type InFlightFile struct {
	Path string `json:"path"`
	// Status is how it changes against the base branch: added or modified.
	Status string `json:"status"`
	// FileURL is the file's page on GitHub; empty while its latest change is
	// only pending.
	FileURL string `json:"fileUrl"`
	// Pending is true when the file has a change that isn't committed yet.
	Pending bool            `json:"pending"`
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

// InFlightResult is the photo data waiting to be merged: what the open pull
// request changes, with the pending changes made over it. PullRequest is nil
// when no pull request titled PullRequestTitle is open; the files are then
// only the pending changes. The combined lists aren't read here; Combined
// reads them.
type InFlightResult struct {
	Repo        string               `json:"repo"`
	Folder      string               `json:"folder"`
	PullRequest *InFlightPullRequest `json:"pullRequest"`
	Files       []InFlightFile       `json:"files"`
	// Albums, Tags, Places, Localizations, MetaInfo, Cameras and Lenses are
	// the album, tag, place, localization, metadata group, camera override
	// and custom lens files in the pull request.
	Albums        InFlightGroups `json:"albums"`
	Tags          InFlightGroups `json:"tags"`
	Places        InFlightGroups `json:"places"`
	Localizations InFlightGroups `json:"localizations"`
	MetaInfo      InFlightGroups `json:"metainfo"`
	Cameras       InFlightGroups `json:"cameras"`
	Lenses        InFlightGroups `json:"lenses"`
}

// groups are r's album, tag, place, localization, metadata group, camera
// override and custom lens files.
func (r *InFlightResult) groups() []*InFlightGroups {
	return []*InFlightGroups{&r.Albums, &r.Tags, &r.Places, &r.Localizations, &r.MetaInfo, &r.Cameras, &r.Lenses}
}

// InFlightGroups is the files of one Kind in the pull request.
type InFlightGroups struct {
	Folder string              `json:"folder"`
	Files  []InFlightGroupFile `json:"files"`
	// allFile is the kind's AllFile, which isn't listed.
	allFile string
}

// InFlightGroupFile is one album, tag, place or localization file in flight,
// as InFlightFile is.
type InFlightGroupFile struct {
	Path    string          `json:"path"`
	Status  string          `json:"status"`
	FileURL string          `json:"fileUrl"`
	Pending bool            `json:"pending"`
	Data    json.RawMessage `json:"data,omitempty"`
	Error   string          `json:"error,omitempty"`
	BaseFile
}

// inFlightPull is the open photo data pull request, as state reads it.
type inFlightPull struct {
	Number  int
	Title   string
	HTMLURL string
	Head    struct{ Ref, SHA string }
	Base    struct{ Ref string }
}

// InFlight lists the JSON files in the data folder, except the combined
// lists, that the open photo data pull request and the pending changes add or
// change against the base branch, with their data as the next Commit will
// have it and as the base branch has it.
func (c *Client) InFlight(ctx context.Context, gh settings.GitHub) (InFlightResult, error) {
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return InFlightResult{}, perr
	}
	folder := w.root + "/" + PhotosFolder
	result := InFlightResult{
		Repo: w.t.repo.FullName, Folder: folder, Files: []InFlightFile{}, PullRequest: w.inFlightPullRequest(),
		Albums:        newInFlightGroups(w.root, Albums),
		Tags:          newInFlightGroups(w.root, Tags),
		Places:        newInFlightGroups(w.root, Kind{Folder: Places.Folder, AllFile: Places.AllFile}),
		Localizations: newInFlightGroups(w.root, Kind{Folder: Localizations.Folder, AllFile: Localizations.AllFile}),
		MetaInfo:      newInFlightGroups(w.root, Kind{Folder: MetaInfo.Folder, AllFile: MetaInfo.AllFile}),
		Cameras:       newInFlightGroups(w.root, Kind{Folder: Cameras.Folder, AllFile: Cameras.AllFile}),
		Lenses:        newInFlightGroups(w.root, Kind{Folder: Lenses.Folder, AllFile: Lenses.AllFile}),
	}
	for _, p := range w.changed(folder, AllPhotosFile) {
		if w.status(p) == statusRemoved {
			continue
		}
		file := InFlightFile{Path: p, Status: w.status(p), FileURL: w.fileURL(p), Pending: w.isPending(p)}
		file.Data, file.Error = w.json(p)
		file.PhotoName, file.ImageURL, file.ImageKey = photoRef(p, file.Data)
		file.BaseFile = w.baseFile(p)
		result.Files = append(result.Files, file)
	}
	for _, g := range result.groups() {
		w.addGroupFiles(g)
	}
	return result, nil
}

func newInFlightGroups(root string, kind Kind) InFlightGroups {
	folder := root + "/" + kind.Folder
	return InFlightGroups{Folder: folder, Files: []InFlightGroupFile{}, allFile: folder + "/" + kind.AllFile}
}

// addGroupFiles lists the files in g's folder, other than its AllFile, that
// w adds or changes against the base branch.
func (w *workspace) addGroupFiles(g *InFlightGroups) {
	for _, p := range w.changed(g.Folder, path.Base(g.allFile)) {
		if w.status(p) == statusRemoved {
			continue
		}
		f := InFlightGroupFile{Path: p, Status: w.status(p), FileURL: w.fileURL(p), Pending: w.isPending(p)}
		f.Data, f.Error = w.json(p)
		f.BaseFile = w.baseFile(p)
		g.Files = append(g.Files, f)
	}
}

// json is p's content as the next Commit will have it, or a message saying
// why it can't be used.
func (w *workspace) json(p string) (json.RawMessage, string) {
	if msg := w.readErr(p); msg != "" {
		return nil, msg
	}
	content, ok := w.file(p)
	switch {
	case !ok:
		return nil, "The file isn't there anymore."
	case !json.Valid(content):
		return nil, "The file isn't valid JSON."
	}
	return json.RawMessage(content), ""
}

// baseFile is p as the base branch has it, or nothing when it isn't there.
func (w *workspace) baseFile(p string) BaseFile {
	f, ok := w.base.files[p]
	switch {
	case !ok:
		return BaseFile{}
	case f.err != "":
		return BaseFile{BaseError: f.err}
	case !json.Valid(f.content):
		return BaseFile{BaseError: "The file on " + w.t.base + " isn't valid JSON."}
	}
	return BaseFile{Base: json.RawMessage(f.content)}
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
