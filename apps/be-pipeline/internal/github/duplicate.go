package github

import (
	"context"
	"encoding/json"
	"net/http"
	"path"
	"strconv"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// PhotoIdentity is what makes a photo the same as an AllPhotosFile entry: its
// original file name, GPS position and creation date, all exactly equal. A nil
// GPSPosition or CreateDate only matches an entry that has none either.
type PhotoIdentity struct {
	File        string  `json:"file"`
	GPSPosition *string `json:"gpsPosition"`
	CreateDate  *string `json:"createDate"`
}

// AllPhotosSource is one place a photo was looked for: AllPhotosFile on the
// base branch, which pages check themselves from Combined, or the photo data
// pull request's files, which FindInPullRequest checks.
type AllPhotosSource struct {
	// Label names it: the base branch, or the photo data pull request.
	Label   string `json:"label"`
	FileURL string `json:"fileUrl"`
	// Found is false when AllPhotosFile isn't on the base branch.
	Found bool `json:"found"`
	// Error says what couldn't be checked, when something couldn't.
	Error string `json:"error,omitempty"`
}

// AllPhotosMatch is an entry for the same photo.
type AllPhotosMatch struct {
	// Source says where it was found first: the pull request file's name and
	// the pull request's label.
	Source  string          `json:"source"`
	FileURL string          `json:"fileUrl"`
	Entry   json.RawMessage `json:"entry"`
}

// AllPhotosCheck is where FindInPullRequest looked and what it found. Sources
// is empty when no photo data pull request is open.
type AllPhotosCheck struct {
	Sources []AllPhotosSource `json:"sources"`
	Matches []AllPhotosMatch  `json:"matches"`
}

// FindInPullRequest looks for photo in the photo data files the photo data
// pull request adds or changes, when one is open. Those files are read
// directly rather than through the pull request's AllPhotosFile, which CI
// rebuilds after each push and may not have caught up with yet. AllPhotosFile
// on the base branch isn't read: pages check it from Combined, which they
// keep. An entry found more than once is listed once. It only reads from
// GitHub.
func (c *Client) FindInPullRequest(ctx context.Context, gh settings.GitHub, photo PhotoIdentity) (AllPhotosCheck, error) {
	if strings.TrimSpace(photo.File) == "" {
		return AllPhotosCheck{}, publishErr(http.StatusBadRequest, "file is required")
	}
	folder, perr := photoFolder(gh.Folder)
	if perr != nil {
		return AllPhotosCheck{}, perr
	}
	owner, name, ok := splitRepo(gh.Repo)
	if !ok || gh.Token == "" {
		return AllPhotosCheck{}, publishErr(http.StatusBadRequest, "Set the GitHub repository and token in Settings first.")
	}
	t := target{owner: owner, name: name, token: gh.Token}
	check := AllPhotosCheck{Sources: []AllPhotosSource{}, Matches: []AllPhotosMatch{}}

	pr, perr := c.findInFlightPull(ctx, t)
	if perr != nil {
		return AllPhotosCheck{}, perr
	}
	if pr == nil {
		return check, nil
	}
	source, files := c.readPullPhotoFiles(ctx, t, folder, pr)
	check.Sources = append(check.Sources, source)
	seen := map[string]bool{}
	for _, f := range files {
		if key := canonicalJSON(f.Data); !seen[key] && sameIdentity(f.Data, photo) {
			seen[key] = true
			check.Matches = append(check.Matches, AllPhotosMatch{Source: path.Base(f.Path) + " in " + source.Label, FileURL: f.FileURL, Entry: f.Data})
		}
	}
	return check, nil
}

// readPullPhotoFiles reads the photo data files pr adds or changes in folder,
// at its head. The source's Error names the files that couldn't be read.
func (c *Client) readPullPhotoFiles(ctx context.Context, t target, folder string, pr *inFlightPull) (AllPhotosSource, []InFlightFile) {
	source := AllPhotosSource{Label: "pull request #" + strconv.Itoa(pr.Number), FileURL: pr.HTMLURL, Found: true}
	listed, perr := c.listPullFiles(ctx, t, pr.Number)
	if perr != nil {
		source.Error = perr.Message
		return source, nil
	}
	var files []InFlightFile
	var unread []string
	for _, f := range listed {
		if f.Status == "removed" || !isPhotoData(folder, f.Filename) {
			continue
		}
		data, msg := c.readJSON(ctx, t, f.Filename, pr.Head.SHA)
		if msg != "" {
			unread = append(unread, path.Base(f.Filename))
			continue
		}
		files = append(files, InFlightFile{Path: f.Filename, FileURL: f.BlobURL, Data: data})
	}
	if len(unread) > 0 {
		source.Error = "couldn't read " + strings.Join(unread, ", ")
	}
	return source, files
}

// sameIdentity reports whether entry is a photo with photo's file name, GPS
// position and creation date.
func sameIdentity(entry json.RawMessage, photo PhotoIdentity) bool {
	var e struct {
		File        *string `json:"file"`
		GPSPosition *string `json:"gpsPosition"`
		CreateDate  *string `json:"createDate"`
	}
	if json.Unmarshal(entry, &e) != nil || e.File == nil {
		return false
	}
	return strings.TrimSpace(*e.File) == strings.TrimSpace(photo.File) &&
		equalPtr(e.GPSPosition, photo.GPSPosition) && equalPtr(e.CreateDate, photo.CreateDate)
}

func equalPtr(a, b *string) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}

// canonicalJSON is raw re-encoded, so entries differing only in formatting
// or key order compare equal.
func canonicalJSON(raw json.RawMessage) string {
	var v any
	if json.Unmarshal(raw, &v) != nil {
		return string(raw)
	}
	b, _ := json.Marshal(v)
	return string(b)
}
