package github

import (
	"context"
	"encoding/json"
	"net/http"
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

// AllPhotosSource is one copy of AllPhotosFile FindInAllPhotos read.
type AllPhotosSource struct {
	// Label names where it was read: the base branch, or the photo data pull request.
	Label   string `json:"label"`
	FileURL string `json:"fileUrl"`
	// Found is false when the file isn't there.
	Found bool `json:"found"`
	// Error says why the file couldn't be checked, when it was found.
	Error string `json:"error,omitempty"`
}

// AllPhotosMatch is an AllPhotosFile entry for the same photo.
type AllPhotosMatch struct {
	// Source is the Label of the copy it was found in first.
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
// Settings (or the default branch) and, when one is open, at the head of the
// photo data pull request, whose copy CI rebuilds with the photos waiting in
// it. An entry found in both is listed once. It only reads from GitHub.
func (c *Client) FindInAllPhotos(ctx context.Context, gh settings.GitHub, photo PhotoIdentity) (AllPhotosCheck, error) {
	if strings.TrimSpace(photo.File) == "" {
		return AllPhotosCheck{}, publishErr(http.StatusBadRequest, "file is required")
	}
	folder, perr := dataFolder(gh.Folder)
	if perr != nil {
		return AllPhotosCheck{}, perr
	}
	t, perr := c.target(ctx, gh)
	if perr != nil {
		return AllPhotosCheck{}, perr
	}
	check := AllPhotosCheck{Path: folder + "/" + AllPhotosFile, Sources: []AllPhotosSource{}, Matches: []AllPhotosMatch{}}

	refs := []allPhotosRef{{label: t.base, ref: t.base, branch: t.base}}
	pr, perr := c.findInFlightPull(ctx, t)
	if perr != nil {
		return AllPhotosCheck{}, perr
	}
	if pr != nil {
		refs = append(refs, allPhotosRef{label: "pull request #" + strconv.Itoa(pr.Number), ref: pr.Head.SHA, branch: pr.Head.Ref})
	}

	seen := map[string]bool{}
	for _, r := range refs {
		source := AllPhotosSource{
			Label:   r.label,
			FileURL: "https://github.com/" + t.repo.FullName + "/blob/" + escapePath(r.branch) + "/" + escapePath(check.Path),
		}
		var entries []json.RawMessage
		source.Found, entries, source.Error = c.readAllPhotosEntries(ctx, t, check.Path, r.ref)
		check.Sources = append(check.Sources, source)
		for _, e := range entries {
			key := canonicalJSON(e)
			if seen[key] || !sameIdentity(e, photo) {
				continue
			}
			seen[key] = true
			check.Matches = append(check.Matches, AllPhotosMatch{Source: source.Label, FileURL: source.FileURL, Entry: e})
		}
	}
	return check, nil
}

// allPhotosRef is a commit to read AllPhotosFile at, and the branch it is on.
type allPhotosRef struct{ label, ref, branch string }

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
