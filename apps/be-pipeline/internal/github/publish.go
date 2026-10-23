package github

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/exif"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// BranchPrefix starts the name of every branch Commit creates, when it opens
// the photo data pull request.
const BranchPrefix = "photo-data/"

// PullRequestTitle is the title of the photo data pull request, which Commit
// opens when none is open.
const PullRequestTitle = "Add photo data"

const pullRequestBody = "Photo data saved from the servenupphotos pipeline. " +
	"Each Commit adds the photo data saved since the last one to this pull request, until it is merged or closed."

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
	// Places are where the photo was taken, as places from PLACES.json;
	// none when they're left out.
	Places []PhotoPlace `json:"places,omitempty"`
}

// PhotoPlace is one place a photo was taken at, from PLACES.json, and how
// the photo relates to it, so "In Gyeongbokgung Palace by Geunjeongmun Gate"
// is two: {"in", "gyeongbokgung-palace"} and {"by", "geunjeongmun-gate"}.
type PhotoPlace struct {
	// Relation is a preposition such as "in", "at", "by" or "near", or ""
	// for none.
	Relation string `json:"relation"`
	// ID is the place's ID in PLACES.json.
	ID string `json:"id"`
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
	// Places are where the photo was taken, by place ID, each with how the
	// photo relates to it. The place name is kept in PlaceName too, for the
	// portfolio.
	Places []PhotoPlace `json:"places"`
	// SpotlightZones are the IDs of the spots on the portfolio the photo is
	// spotlighted in, such as "homepage", the homepage's background. They're
	// picked on the Site Spotlight page.
	SpotlightZones []string `json:"spotlightZones"`
	// SocialPosts are the photo's posts on social media, posted or
	// scheduled, written on the Photo page.
	SocialPosts []SocialPost `json:"socialPosts"`
}

// SocialPost is one post of a photo on social media, such as on Instagram.
type SocialPost struct {
	// Platform is where it's posted, such as "instagram".
	Platform string `json:"platform"`
	// Status is "scheduled" or "posted".
	Status string `json:"status"`
	// Date is the day it's posted or scheduled for, as YYYY-MM-DD, or nil
	// when it isn't known.
	Date *string `json:"date"`
	// URL is the post's link, or "" before it's posted.
	URL string `json:"url"`
	// Caption is the post's text, without its hashtags.
	Caption string `json:"caption"`
	// Hashtags are the post's hashtags, without their "#".
	Hashtags []string `json:"hashtags"`
}

// newPhotoJSON is the content of a new photo file. It is also the list of
// fields every photo file should have, with their defaults: Backfill adds
// the ones an older file is missing from newPhotoJSON("", exif.Sanitized{}).
// Give a new field its default here, such as an empty list rather than nil.
func newPhotoJSON(file string, s exif.Sanitized) photoJSON {
	return photoJSON{
		Title: s.Title, Comment: s.Comment, File: file, Sanitized: s, Albums: []string{}, Tags: []string{},
		Places: []PhotoPlace{}, SpotlightZones: []string{}, SocialPosts: []SocialPost{},
	}
}

// PublishResult says where a photo's JSON went: into the pending changes,
// for the next Commit to commit to the photo data pull request.
type PublishResult struct {
	Path string `json:"path"`
	// PullRequestURL and PullRequestNumber are the open photo data pull
	// request's; empty when none is open, and Commit will open one.
	PullRequestURL    string `json:"pullRequestUrl,omitempty"`
	PullRequestNumber int    `json:"pullRequestNumber,omitempty"`
	// Data is the JSON saved, so pages can show it before Commit rebuilds the
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

// target is where the photo data goes: one repository and base branch.
type target struct {
	owner, name, token string
	repo               repoInfo
	base               string
}

// Publish saves photo as <folder>/photos/<name>.json in the pending changes,
// for the next Commit to commit to the photo data pull request (opening one
// when none is open). It never overwrites a file that already exists.
func (c *Client) Publish(ctx context.Context, gh settings.GitHub, photo Photo) (PublishResult, error) {
	folder, perr := photoFolder(gh.Folder)
	if perr != nil {
		return PublishResult{}, perr
	}
	path, perr := filePath(folder, photo.Name)
	if perr != nil {
		return PublishResult{}, perr
	}
	data := newPhotoJSON(photo.File, photo.Sanitized)
	data.Albums, data.Tags = appendMissing(data.Albums, photo.Albums), appendMissing(data.Tags, photo.Tags)
	data.Places = append(data.Places, photo.Places...)
	content, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return PublishResult{}, publishErr(http.StatusInternalServerError, "Couldn't encode the photo data.")
	}
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return PublishResult{}, perr
	}
	return c.saveNewFile(w, path, append(content, '\n'))
}

// saveNewFile saves content as path, a new file, in the pending changes. It
// fails when path is already on the base branch, the pull request's branch or
// in the pending changes.
func (c *Client) saveNewFile(w *workspace, path string, content []byte) (PublishResult, error) {
	if perr := w.ensureAbsent(path); perr != nil {
		return PublishResult{}, perr
	}
	if perr := c.save(w, map[string][]byte{path: content}); perr != nil {
		return PublishResult{}, perr
	}
	result := PublishResult{Path: path, Data: json.RawMessage(content)}
	if w.pr != nil {
		result.PullRequestURL, result.PullRequestNumber = w.pr.HTMLURL, w.pr.Number
	}
	return result, nil
}

// ensureAbsent fails when path is already a file, on the base branch or as
// the next Commit will have it.
func (w *workspace) ensureAbsent(path string) *PublishError {
	_, there := w.file(path)
	switch {
	case w.onBase(path):
		return publishErr(http.StatusConflict, "%s already exists on %s. Pick another file name.", path, w.t.base)
	case there && w.isPending(path):
		return publishErr(http.StatusConflict, "%s is already saved, waiting for Commit. Pick another file name.", path)
	case there:
		return publishErr(http.StatusConflict, "%s already exists on %s. Pick another file name.", path, w.branch())
	}
	return nil
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
		return publishErr(http.StatusBadGateway, tokenRejected)
	case isRateLimited(res):
		return rateLimitErr(res.Header)
	case res.Status == http.StatusForbidden || res.Status == http.StatusNotFound:
		return publishErr(http.StatusBadGateway,
			"The token can't write to this repository. Give it Contents and Pull requests read and write access.")
	default:
		return publishErr(http.StatusBadGateway, "GitHub responded %d when %s.", res.Status, doing)
	}
}

// readAccess asks for read access, when the token can't read the repository.
const readAccess = "The token can't read this repository. Give it Contents and Pull requests read access."

// readCheck is check for calls that only read, so a 403 or 404 asks for read
// access rather than write access.
func readCheck(res response, err error, doing string) *PublishError {
	if err == nil && (res.Status == http.StatusForbidden || res.Status == http.StatusNotFound) && !isRateLimited(res) {
		return publishErr(http.StatusBadGateway, readAccess)
	}
	return check(res, err, doing)
}
