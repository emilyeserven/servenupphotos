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
	adds := make([]photoAdds, 0, len(bulk.Photos))
	for _, p := range bulk.Photos {
		adds = append(adds, photoAdds{path: p.Path, ids: p.Tags})
	}
	saved, err := c.saveGroupsOnPhotos(ctx, gh, Tags, bulk.NewTags, adds)
	if err != nil {
		return BulkTagsResult{}, err
	}
	return BulkTagsResult{pendingSave: saved.pendingSave, NewTags: saved.made, Photos: saved.photos}, nil
}

// photoAdds is the IDs of one kind's groups to add to one photo file.
type photoAdds struct {
	path string
	ids  []string
}

// groupsSaved is what saveGroupsOnPhotos saved.
type groupsSaved struct {
	pendingSave
	// made is how many group files were made, and photos how many photo
	// files changed.
	made, photos int
}

// saveGroupsOnPhotos makes made, new groups of kind, and adds each of adds'
// IDs to its photo, all as one save in the pending changes. Nothing is saved
// when a group can't be made or a photo can't be read.
func (c *Client) saveGroupsOnPhotos(ctx context.Context, gh settings.GitHub, kind Kind, made []NewGroup, adds []photoAdds) (groupsSaved, *PublishError) {
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return groupsSaved{}, perr
	}
	groups := scan.w.groups()
	groupChanges, perr := newGroupFiles(scan.w, kind, groups, made)
	if perr != nil {
		return groupsSaved{}, perr
	}
	photoChanges, perr := groupedPhotos(scan, kind, groups[kind.Folder], adds)
	if perr != nil {
		return groupsSaved{}, perr
	}
	if len(groupChanges)+len(photoChanges) == 0 {
		return groupsSaved{}, publishErr(http.StatusConflict, "Those photos already have those %ss, so there's nothing to change.", kind.Name)
	}
	saved, perr := c.saveFiles(scan.w, slices.Concat(groupChanges, photoChanges))
	if perr != nil {
		return groupsSaved{}, perr
	}
	return groupsSaved{pendingSave: saved, made: len(groupChanges), photos: len(photoChanges)}, nil
}

// newGroupFiles is a new file of kind for each of made, as CreateGroup checks
// and writes them, parents first. A tag's name is its ID. groups gets each
// one as it's made, so a later one can be under it.
func newGroupFiles(w *workspace, kind Kind, groups map[string][]Group, made []NewGroup) ([]ScanChange, *PublishError) {
	var changes []ScanChange
	for _, t := range parentsFirst(made) {
		if kind == Tags {
			t.Name = t.ID
		}
		change, perr := newGroupFile(w, kind, groups, t)
		if perr != nil {
			return nil, perr
		}
		changes = append(changes, change)
	}
	return changes, nil
}

// newGroupFile is the file of t, a new group of kind, checked as CreateGroup
// checks it, and adds t to groups.
func newGroupFile(w *workspace, kind Kind, groups map[string][]Group, t NewGroup) (ScanChange, *PublishError) {
	content, perr := validGroup(kind, t)
	if perr == nil {
		perr = checkCollision(groups, t)
	}
	if perr == nil && content.Parent != nil {
		perr = checkParent(kind, groups[kind.Folder], content.ID, *content.Parent)
	}
	if perr != nil {
		return ScanChange{}, publishErr(perr.Status, "%s: %s Nothing was changed.", t.ID, perr.Message)
	}
	file := w.root + "/" + kind.Folder + "/" + content.ID + ".json"
	if perr := w.ensureAbsent(file); perr != nil {
		return ScanChange{}, perr
	}
	b, _ := json.MarshalIndent(fileContent(kind, content), "", "  ")
	groups[kind.Folder] = append(groups[kind.Folder], Group{ID: content.ID, Name: content.Name, Parent: t.Parent, Path: file})
	return ScanChange{Path: file, After: append(b, '\n')}, nil
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

// groupedPhotos is each of adds' photos with its IDs added, leaving out the
// ones that already have them. Each ID must be one of known, kind's groups,
// which has the new ones too.
func groupedPhotos(scan baseURLScan, kind Kind, known []Group, adds []photoAdds) ([]ScanChange, *PublishError) {
	var changes []ScanChange
	seen := map[string]bool{}
	for _, p := range adds {
		if seen[p.path] {
			return nil, publishErr(http.StatusBadRequest, "%s is listed more than once.", p.path)
		}
		seen[p.path] = true
		change, perr := groupedPhoto(scan, kind, known, p)
		if perr != nil {
			return nil, perr
		}
		if change != nil {
			changes = append(changes, *change)
		}
	}
	return changes, nil
}

// groupedPhoto is the photo file at p.path with p.ids added, or nil when it
// already has them.
func groupedPhoto(scan baseURLScan, kind Kind, known []Group, p photoAdds) (*ScanChange, *PublishError) {
	for _, id := range p.ids {
		if !slices.ContainsFunc(known, func(g Group) bool { return g.ID == id && g.Error == "" }) {
			return nil, publishErr(http.StatusBadRequest, "%q isn't one of the %ss, so nothing was changed.", id, kind.Name)
		}
	}
	photos, perr := picked(scan, []string{p.path})
	if perr != nil {
		return nil, perr
	}
	before := photos[0].file.content
	after, err := withGroups(before, photoGroupsOf(kind, p.ids))
	if err != nil {
		return nil, publishErr(http.StatusConflict, "%s: %s, so nothing was changed.", p.path, err)
	}
	if bytes.Equal(before, after) {
		return nil, nil
	}
	return &ScanChange{Path: p.path, Before: before, After: after}, nil
}

// photoGroupsOf is ids as the albums, tags or genres of kind to add.
func photoGroupsOf(kind Kind, ids []string) PhotoGroups {
	switch kind {
	case Albums:
		return PhotoGroups{Albums: ids}
	case Genres:
		return PhotoGroups{Genres: ids}
	}
	return PhotoGroups{Tags: ids}
}
