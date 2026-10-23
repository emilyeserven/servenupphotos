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
// is empty when no photo data pull request is open, nothing is waiting for
// Commit and the base branch has no drafts.
type AllPhotosCheck struct {
	Sources []AllPhotosSource `json:"sources"`
	Matches []AllPhotosMatch  `json:"matches"`
}

// FindInPullRequest looks for photo in the photo data files the photo data
// pull request and the pending changes add or change, as the next Commit will
// have them, and in the drafts on the base branch (see baseDrafts). Those files are read directly rather than through the pull
// request's AllPhotosFile, which is only rebuilt by Commit. AllPhotosFile on
// the base branch isn't read: pages check it from Combined, which they keep.
// An entry found more than once is listed once. It changes nothing.
func (c *Client) FindInPullRequest(ctx context.Context, gh settings.GitHub, photo PhotoIdentity) (AllPhotosCheck, error) {
	if strings.TrimSpace(photo.File) == "" {
		return AllPhotosCheck{}, publishErr(http.StatusBadRequest, "file is required")
	}
	folder, perr := photoFolder(gh.Folder)
	if perr != nil {
		return AllPhotosCheck{}, perr
	}
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return AllPhotosCheck{}, perr
	}
	check := AllPhotosCheck{Sources: []AllPhotosSource{}, Matches: []AllPhotosMatch{}}
	seen := map[string]bool{}
	source, files := w.inFlightPhotos(folder)
	if w.pr != nil || len(files) > 0 {
		check.add(source, files, photo, seen)
	}
	if source, files := w.baseDrafts(folder); len(files) > 0 {
		check.add(source, files, photo, seen)
	}
	return check, nil
}

// add adds source to the places check looked, and its files for the same
// photo as photo to its matches, unless seen has them already.
func (check *AllPhotosCheck) add(source AllPhotosSource, files []InFlightFile, photo PhotoIdentity, seen map[string]bool) {
	check.Sources = append(check.Sources, source)
	for _, f := range files {
		if key := canonicalJSON(f.Data); !seen[key] && sameIdentity(f.Data, photo) {
			seen[key] = true
			check.Matches = append(check.Matches, AllPhotosMatch{Source: path.Base(f.Path) + " in " + source.Label, FileURL: f.FileURL, Entry: f.Data})
		}
	}
}

// inFlightPhotos reads the photo data files in folder that w adds or changes
// against the base branch. The source's Error names the files that couldn't
// be read.
func (w *workspace) inFlightPhotos(folder string) (AllPhotosSource, []InFlightFile) {
	source := AllPhotosSource{Label: "the changes waiting for Commit", Found: true}
	if w.pr != nil {
		source.Label, source.FileURL = "pull request #"+strconv.Itoa(w.pr.Number), w.pr.HTMLURL
	}
	var files []InFlightFile
	var unread []string
	for _, p := range w.changed(folder, AllPhotosFile) {
		if w.status(p) == statusRemoved {
			continue
		}
		data, msg := w.json(p)
		if msg != "" {
			unread = append(unread, path.Base(p))
			continue
		}
		files = append(files, InFlightFile{Path: p, FileURL: w.fileURL(p), Data: data})
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
