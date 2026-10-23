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

// PhotoGroups adds albums and tags, by ID, to the photo files at Paths.
type PhotoGroups struct {
	Paths  []string `json:"paths"`
	Albums []string `json:"albums"`
	Tags   []string `json:"tags"`
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

// AddPhotoGroups adds each of add's albums and tags that a photo file in
// add.Paths doesn't list yet to its "albums" and "tags", in the pending
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
		content, err := withGroups(f.content, add.Albums, add.Tags)
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
		return PhotoGroupsResult{}, publishErr(http.StatusConflict, "Those photos already have those albums and tags, so there's nothing to change.")
	}

	saved, perr := c.saveScan(scan, entries)
	if perr != nil {
		return PhotoGroupsResult{}, perr
	}
	return PhotoGroupsResult{pendingSave: saved, Files: len(entries)}, nil
}

// validPhotoGroups checks there are photos, and albums or tags with valid IDs
// to add to them.
func validPhotoGroups(add PhotoGroups) *PublishError {
	if len(add.Paths) == 0 {
		return publishErr(http.StatusBadRequest, "Choose the photos to add albums and tags to.")
	}
	if len(add.Albums) == 0 && len(add.Tags) == 0 {
		return publishErr(http.StatusBadRequest, "Choose albums or tags to add.")
	}
	if len(add.Albums)+len(add.Tags) > maxGroupsPerSave {
		return publishErr(http.StatusBadRequest, "Add up to %d albums and tags at a time.", maxGroupsPerSave)
	}
	seen := map[string]bool{}
	for _, p := range add.Paths {
		if seen[p] {
			return publishErr(http.StatusBadRequest, "%s is listed more than once.", p)
		}
		seen[p] = true
	}
	for _, id := range slices.Concat(add.Albums, add.Tags) {
		if !groupIDPattern.MatchString(id) || len(id) > maxGroupIDLength {
			return publishErr(http.StatusBadRequest, "%q isn't an album or tag ID.", id)
		}
	}
	return nil
}

// withGroups is content, a photo file, with albums and tags added to its
// "albums" and "tags" lists after the IDs they already have.
func withGroups(content []byte, albums, tags []string) ([]byte, error) {
	var current struct {
		Albums []string `json:"albums"`
		Tags   []string `json:"tags"`
	}
	if err := json.Unmarshal(content, &current); err != nil {
		return nil, fmt.Errorf("its albums and tags aren't lists of IDs")
	}
	out := content
	for _, list := range []struct {
		key        string
		have, more []string
	}{{"albums", current.Albums, albums}, {"tags", current.Tags, tags}} {
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
