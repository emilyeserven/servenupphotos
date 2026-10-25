package github

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"sort"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// PhotoGroups adds albums, tags and genres, by ID, to the photo files at
// Paths.
type PhotoGroups struct {
	Paths  []string `json:"paths"`
	Albums []string `json:"albums"`
	Tags   []string `json:"tags"`
	Genres []string `json:"genres"`
}

// PhotoGroupsResult says where the albums and tags were saved: in the pending
// changes, for the next Commit.
type PhotoGroupsResult struct {
	pendingSave
	// Files is how many photo files changed; the others already had them.
	Files int `json:"files"`
}

// maxGroupsPerSave caps how many albums or tags one save adds.
const maxGroupsPerSave = 100

// AddPhotoGroups adds each of add's albums, tags and genres that a photo file
// in add.Paths doesn't list yet to its "albums", "tags" and "genres", in the pending
// changes as ReplaceBaseURL saves them. Nothing else in the files changes, and
// nothing is saved when one of them can't be read.
func (c *Client) AddPhotoGroups(ctx context.Context, gh settings.GitHub, add PhotoGroups) (PhotoGroupsResult, error) {
	if perr := validPhotoGroups(add); perr != nil {
		return PhotoGroupsResult{}, perr
	}
	want := map[string]bool{}
	for _, p := range add.Paths {
		want[p] = true
	}
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return PhotoGroupsResult{}, perr
	}

	var entries []map[string]string
	for _, f := range scan.files {
		if !want[f.path] {
			continue
		}
		delete(want, f.path)
		if f.err != "" {
			return PhotoGroupsResult{}, publishErr(http.StatusConflict,
				"%s couldn't be read (%s), so nothing was changed.", f.path, f.err)
		}
		content, err := withGroups(f.content, add)
		if err != nil {
			return PhotoGroupsResult{}, publishErr(http.StatusConflict, "%s: %s, so nothing was changed.", f.path, err)
		}
		if !bytes.Equal(content, f.content) {
			entries = append(entries, map[string]string{"path": f.path, "mode": "100644", "type": "blob", "content": string(content)})
		}
	}
	if len(want) > 0 {
		missing := make([]string, 0, len(want))
		for p := range want {
			missing = append(missing, p)
		}
		sort.Strings(missing)
		return PhotoGroupsResult{}, publishErr(http.StatusNotFound,
			"%s isn't a photo file on %s, so nothing was changed.", strings.Join(missing, ", "), scan.branch)
	}
	if len(entries) == 0 {
		return PhotoGroupsResult{}, publishErr(http.StatusConflict, "Those photos already have those albums, tags and genres, so there's nothing to change.")
	}

	saved, perr := c.saveScan(scan, entries)
	if perr != nil {
		return PhotoGroupsResult{}, perr
	}
	return PhotoGroupsResult{pendingSave: saved, Files: len(entries)}, nil
}

// validPhotoGroups checks there are photos, and albums, tags or genres with
// valid IDs to add to them.
func validPhotoGroups(add PhotoGroups) *PublishError {
	if len(add.Paths) == 0 {
		return publishErr(http.StatusBadRequest, "Choose the photos to add albums, tags or genres to.")
	}
	ids := slices.Concat(add.Albums, add.Tags, add.Genres)
	if len(ids) == 0 {
		return publishErr(http.StatusBadRequest, "Choose albums, tags or genres to add.")
	}
	if len(ids) > maxGroupsPerSave {
		return publishErr(http.StatusBadRequest, "Add up to %d albums, tags and genres at a time.", maxGroupsPerSave)
	}
	seen := map[string]bool{}
	for _, p := range add.Paths {
		if seen[p] {
			return publishErr(http.StatusBadRequest, "%s is listed more than once.", p)
		}
		seen[p] = true
	}
	for _, id := range ids {
		if !groupIDPattern.MatchString(id) || len(id) > maxGroupIDLength {
			return publishErr(http.StatusBadRequest, "%q isn't an album, tag or genre ID.", id)
		}
	}
	return nil
}

// withGroups is content, a photo file, with add's albums, tags and genres
// added to its "albums", "tags" and "genres" lists after the IDs they
// already have.
func withGroups(content []byte, add PhotoGroups) ([]byte, error) {
	var current struct {
		Albums []string `json:"albums"`
		Tags   []string `json:"tags"`
		Genres []string `json:"genres"`
	}
	if err := json.Unmarshal(content, &current); err != nil {
		return nil, fmt.Errorf("its albums, tags and genres aren't lists of IDs")
	}
	out := content
	for _, list := range []struct {
		key        string
		have, more []string
	}{{"albums", current.Albums, add.Albums}, {"tags", current.Tags, add.Tags}, {"genres", current.Genres, add.Genres}} {
		merged := appendMissing(list.have, list.more)
		if len(list.more) == 0 || len(merged) == len(list.have) {
			continue
		}
		value, err := json.MarshalIndent(merged, "  ", "  ")
		if err != nil {
			return nil, err
		}
		if out, err = setTopLevelList(out, list.key, value); err != nil {
			return nil, err
		}
	}
	return out, nil
}

// appendMissing is have with each of more it doesn't contain added, in order.
func appendMissing(have, more []string) []string {
	out := append([]string{}, have...)
	for _, id := range more {
		if !slices.Contains(out, id) {
			out = append(out, id)
		}
	}
	return out
}
