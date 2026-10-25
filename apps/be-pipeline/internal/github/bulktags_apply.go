package github

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"slices"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// BulkTagsPhoto is the tags to add to one photo file, by ID.
type BulkTagsPhoto struct {
	Path string   `json:"path"`
	Tags []string `json:"tags"`
}

// BulkTags is what Bulk Tagging saves, as the review left it: the new tags to
// make, and the tags to add to each photo.
type BulkTags struct {
	NewTags []NewGroup      `json:"newTags"`
	Photos  []BulkTagsPhoto `json:"photos"`
}

// BulkTagsResult says where Bulk Tagging's changes were saved: in the pending
// changes, for the next Commit.
type BulkTagsResult struct {
	pendingSave
	// NewTags is how many tags were made.
	NewTags int `json:"newTags"`
	// Photos is how many photo files got tags; the others already had them.
	Photos int `json:"photos"`
}

// ApplyBulkTags makes the new tags in bulk, each parent before the tags under
// it, and adds the tags to each photo, all as one save in the pending changes.
// Nothing is saved when a tag can't be made or a photo can't be read.
func (c *Client) ApplyBulkTags(ctx context.Context, gh settings.GitHub, bulk BulkTags) (BulkTagsResult, error) {
	if len(bulk.Photos) == 0 || len(bulk.Photos) > maxBulkTagPhotos {
		return BulkTagsResult{}, publishErr(http.StatusBadRequest, "Tag 1 to %d photos at a time.", maxBulkTagPhotos)
	}
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return BulkTagsResult{}, perr
	}
	groups := scan.w.groups()
	tagChanges, perr := newTagFiles(scan.w, groups, bulk.NewTags)
	if perr != nil {
		return BulkTagsResult{}, perr
	}
	photoChanges, perr := taggedPhotos(scan, groups[Tags.Folder], bulk)
	if perr != nil {
		return BulkTagsResult{}, perr
	}
	if len(tagChanges)+len(photoChanges) == 0 {
		return BulkTagsResult{}, publishErr(http.StatusConflict, "Those photos already have those tags, so there's nothing to change.")
	}
	saved, perr := c.saveFiles(scan.w, slices.Concat(tagChanges, photoChanges))
	if perr != nil {
		return BulkTagsResult{}, perr
	}
	return BulkTagsResult{pendingSave: saved, NewTags: len(tagChanges), Photos: len(photoChanges)}, nil
}

// newTagFiles is a new tag file for each of tags, as CreateGroup checks and
// writes them, parents first. groups gets each one as it's made, so a later
// one can be under it.
func newTagFiles(w *workspace, groups map[string][]Group, tags []NewGroup) ([]ScanChange, *PublishError) {
	var changes []ScanChange
	for _, t := range parentsFirst(tags) {
		t.Name = t.ID
		content, perr := validGroup(Tags, t)
		if perr == nil {
			perr = checkCollision(groups, t)
		}
		if perr == nil && content.Parent != nil {
			perr = checkParent(Tags, groups[Tags.Folder], content.ID, *content.Parent)
		}
		if perr != nil {
			return nil, publishErr(perr.Status, "%s: %s Nothing was changed.", t.ID, perr.Message)
		}
		file := w.root + "/" + Tags.Folder + "/" + content.ID + ".json"
		if perr := w.ensureAbsent(file); perr != nil {
			return nil, perr
		}
		b, _ := json.MarshalIndent(fileContent(Tags, content), "", "  ")
		changes = append(changes, ScanChange{Path: file, After: append(b, '\n')})
		groups[Tags.Folder] = append(groups[Tags.Folder], Group{ID: content.ID, Name: content.Name, Parent: t.Parent, Path: file})
	}
	return changes, nil
}

// parentsFirst is tags with each one after the new tag it's under, when that's
// one of them too.
func parentsFirst(tags []NewGroup) []NewGroup {
	out := make([]NewGroup, 0, len(tags))
	done := map[string]bool{}
	for len(out) < len(tags) {
		added := false
		for _, t := range tags {
			if !done[t.ID] && (!isNewTag(tags, t.Parent) || done[t.Parent]) {
				out, done[t.ID], added = append(out, t), true, true
			}
		}
		if !added {
			// The rest are each other's parents; checkParent says so.
			return append(out, slices.DeleteFunc(slices.Clone(tags), func(t NewGroup) bool { return done[t.ID] })...)
		}
	}
	return out
}

// isNewTag is whether id is one of tags.
func isNewTag(tags []NewGroup, id string) bool {
	return id != "" && slices.ContainsFunc(tags, func(t NewGroup) bool { return t.ID == id })
}

// taggedPhotos is each of bulk's photos with its tags added, leaving out the
// ones that already have them. Each tag must be a tag in tags, which has the
// new ones too.
func taggedPhotos(scan baseURLScan, tags []Group, bulk BulkTags) ([]ScanChange, *PublishError) {
	var changes []ScanChange
	seen := map[string]bool{}
	for _, p := range bulk.Photos {
		if seen[p.Path] {
			return nil, publishErr(http.StatusBadRequest, "%s is listed more than once.", p.Path)
		}
		seen[p.Path] = true
		change, perr := taggedPhoto(scan, tags, p)
		if perr != nil {
			return nil, perr
		}
		if change != nil {
			changes = append(changes, *change)
		}
	}
	return changes, nil
}

// taggedPhoto is the photo file at p.Path with p.Tags added, or nil when it
// already has them.
func taggedPhoto(scan baseURLScan, tags []Group, p BulkTagsPhoto) (*ScanChange, *PublishError) {
	for _, id := range p.Tags {
		if !slices.ContainsFunc(tags, func(g Group) bool { return g.ID == id && g.Error == "" }) {
			return nil, publishErr(http.StatusBadRequest, "%q isn't a tag, so nothing was changed.", id)
		}
	}
	photos, perr := picked(scan, []string{p.Path})
	if perr != nil {
		return nil, perr
	}
	before := photos[0].file.content
	after, err := withGroups(before, PhotoGroups{Tags: p.Tags})
	if err != nil {
		return nil, publishErr(http.StatusConflict, "%s: %s, so nothing was changed.", p.Path, err)
	}
	if bytes.Equal(before, after) {
		return nil, nil
	}
	return &ScanChange{Path: p.Path, Before: before, After: after}, nil
}
