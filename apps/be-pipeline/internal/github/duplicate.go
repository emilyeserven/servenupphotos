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

// AllPhotosSource is one place FindInAllPhotos looked: AllPhotosFile on the
// base branch, or the photo data pull request's files.
type AllPhotosSource struct {
	// Label names it: the base branch, or the photo data pull request.
	Label   string `json:"label"`
	FileURL string `json:"fileUrl"`
	// Found is false when AllPhotosFile isn't on the base branch.
	Found bool `json:"found"`
	// Error says what couldn't be checked, when something couldn't.
	Error string `json:"error,omitempty"`
}

// AllPhotosMatch is an AllPhotosFile entry for the same photo.
type AllPhotosMatch struct {
	// Source says where it was found first: the base branch's label, or the
	// pull request file's name and the pull request's label.
	Source  string          `json:"source"`
	FileURL string          `json:"fileUrl"`
	Entry   json.RawMessage `json:"entry"`
}

// AllPhotosCheck is where FindInAllPhotos looked and what it found.
type AllPhotosCheck struct {
	Path    string            `json:"path"`
	Sources []AllPhotosSource `json:"sources"`
	Matches []AllPhotosMatch  `json:"matches"`
}

// FindInAllPhotos looks for photo in AllPhotosFile on the base branch from
// Settings (or the default branch) and, when one is open, in the photo data
// files the photo data pull request adds or changes. Those files are read
// directly rather than through the pull request's AllPhotosFile, which CI
// rebuilds after each push and may not have caught up with yet. An entry
// found more than once is listed once. It only reads from GitHub.
func (c *Client) FindInAllPhotos(ctx context.Context, gh settings.GitHub, photo PhotoIdentity) (AllPhotosCheck, error) {
	if strings.TrimSpace(photo.File) == "" {
		return AllPhotosCheck{}, publishErr(http.StatusBadRequest, "file is required")
	}
	folder, perr := photoFolder(gh.Folder)
	if perr != nil {
		return AllPhotosCheck{}, perr
	}
	t, perr := c.target(ctx, gh)
	if perr != nil {
		return AllPhotosCheck{}, perr
	}
	check := AllPhotosCheck{Path: folder + "/" + AllPhotosFile, Sources: []AllPhotosSource{}, Matches: []AllPhotosMatch{}}
	seen := map[string]bool{}
	add := func(source, fileURL string, entry json.RawMessage) {
		if key := canonicalJSON(entry); !seen[key] && sameIdentity(entry, photo) {
			seen[key] = true
			check.Matches = append(check.Matches, AllPhotosMatch{Source: source, FileURL: fileURL, Entry: entry})
		}
	}

	base := AllPhotosSource{
		Label:   t.base,
		FileURL: "https://github.com/" + t.repo.FullName + "/blob/" + escapePath(t.base) + "/" + escapePath(check.Path),
	}
	var entries []json.RawMessage
	base.Found, entries, base.Error = c.readAllPhotosEntries(ctx, t, check.Path, t.base)
	check.Sources = append(check.Sources, base)
	for _, e := range entries {
		add(base.Label, base.FileURL, e)
	}

	pr, perr := c.findInFlightPull(ctx, t)
	if perr != nil {
		return AllPhotosCheck{}, perr
	}
	if pr != nil {
		source, files := c.readPullPhotoFiles(ctx, t, folder, pr)
		check.Sources = append(check.Sources, source)
		for _, f := range files {
			add(path.Base(f.Path)+" in "+source.Label, f.FileURL, f.Data)
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

// readAllPhotosEntries reads the AllPhotosFile at file and ref, returning
// whether it exists, its entries, and why it couldn't be used, if it couldn't.
func (c *Client) readAllPhotosEntries(ctx context.Context, t target, file, ref string) (bool, []json.RawMessage, string) {
	content, found, msg := c.readFile(ctx, t, file, ref)
	if !found {
		return false, nil, ""
	}
	if msg != "" {
		return true, nil, msg
	}
	var entries []json.RawMessage
	if err := json.Unmarshal(content, &entries); err != nil || entries == nil {
		return true, nil, "The file isn't a JSON array."
	}
	return true, entries, ""
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

// BaseAllPhotos is AllPhotosFile on the base branch from Settings (or the
// default branch): the photos already in the portfolio.
type BaseAllPhotos struct {
	InFlightAllPhotos
	// Branch is the base branch it was read from.
	Branch string `json:"branch"`
}

// AllPhotosOnBase reads AllPhotosFile on the base branch from Settings, or
// the default branch. It only reads from GitHub.
func (c *Client) AllPhotosOnBase(ctx context.Context, gh settings.GitHub) (BaseAllPhotos, error) {
	folder, perr := photoFolder(gh.Folder)
	if perr != nil {
		return BaseAllPhotos{}, perr
	}
	t, perr := c.target(ctx, gh)
	if perr != nil {
		return BaseAllPhotos{}, perr
	}
	all, _ := c.readAllPhotos(ctx, t, folder, t.base)
	if all.Found {
		all.FileURL = "https://github.com/" + t.repo.FullName + "/blob/" + escapePath(t.base) + "/" + escapePath(all.Path)
	}
	return BaseAllPhotos{InFlightAllPhotos: all, Branch: t.base}, nil
}
