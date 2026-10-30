package github

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"slices"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// PruneTagsResult says where Tag pruning's changes were saved: in the pending
// changes, for the next Commit.
type PruneTagsResult struct {
	pendingSave
	// Deleted is how many tag files were deleted, merged or removed.
	Deleted int `json:"deleted"`
	// Reparented is how many tags got a new parent, the ones the changes
	// asked for and the ones under a deleted tag.
	Reparented int `json:"reparented"`
	// Photos is how many photo files had their tags changed.
	Photos int `json:"photos"`
}

// ApplyPruneTags merges, removes and reparents tags as req says, all as one
// save in the pending changes: a merged or removed tag's file is deleted, the
// photos listing it get the tag it went into (or lose it), and the tags under
// it go under that tag (or its parent). Nothing is saved when a change can't
// be made or a photo file can't be read.
func (c *Client) ApplyPruneTags(ctx context.Context, gh settings.GitHub, req PruneTags) (PruneTagsResult, error) {
	req = cleanPrune(req)
	if req.size() == 0 {
		return PruneTagsResult{}, publishErr(http.StatusBadRequest, "Pick at least one change to make to the tags.")
	}
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return PruneTagsResult{}, perr
	}
	if perr := allReadable(scan); perr != nil {
		return PruneTagsResult{}, perr
	}
	p := newTagPruner(scan.w.groups()[Tags.Folder])
	for _, s := range p.steps(req) {
		if why := s.run(); why != "" {
			return PruneTagsResult{}, publishErr(http.StatusConflict, "Couldn't %s: %s. Nothing was changed.", s.said, why)
		}
	}
	tagChanges, reparented, perr := p.tagFileChanges(scan.w)
	if perr != nil {
		return PruneTagsResult{}, perr
	}
	photoChanges, perr := p.photoChanges(scan)
	if perr != nil {
		return PruneTagsResult{}, perr
	}
	saved, perr := c.saveFiles(scan.w, slices.Concat(tagChanges, photoChanges))
	if perr != nil {
		return PruneTagsResult{}, perr
	}
	return PruneTagsResult{pendingSave: saved, Deleted: len(p.gone), Reparented: reparented, Photos: len(photoChanges)}, nil
}

// allReadable fails when a photo file in scan couldn't be read, since it may
// list a tag that's pruned.
func allReadable(scan baseURLScan) *PublishError {
	for _, f := range scan.files {
		if f.err != "" {
			return publishErr(http.StatusConflict, "%s couldn't be read (%s), so the tags weren't changed.", f.path, f.err)
		}
	}
	return nil
}

// tagFileChanges is each pruned tag's file deleted and each kept tag's file
// with its new parent, sorted by path, and how many got a new parent.
func (p *tagPruner) tagFileChanges(w *workspace) ([]ScanChange, int, *PublishError) {
	var changes []ScanChange
	reparented := 0
	for _, id := range p.sortedIDs() {
		g := p.tags[id]
		current, _ := w.groupFile(g.Path)
		if _, gone := p.gone[id]; gone {
			changes = append(changes, ScanChange{Path: g.Path, Before: current})
			continue
		}
		parent := p.parentOf(id)
		if parent == g.Parent {
			continue
		}
		content, err := setTopLevel(current, parentKey, parentValue(parent))
		if err != nil {
			return nil, 0, publishErr(http.StatusConflict, "%s: %s", g.Path, err)
		}
		changes = append(changes, ScanChange{Path: g.Path, Before: current, After: content})
		reparented++
	}
	return changes, reparented, nil
}

// sortedIDs is every tag's ID, sorted.
func (p *tagPruner) sortedIDs() []string {
	ids := make([]string, 0, len(p.tags))
	for id := range p.tags {
		ids = append(ids, id)
	}
	slices.Sort(ids)
	return ids
}

// parentValue is parent as a tag file's "parent" holds it: null at the top
// level.
func parentValue(parent string) []byte {
	if parent == "" {
		return []byte("null")
	}
	b, _ := json.Marshal(parent)
	return b
}

// isGone is whether id is a tag pruning merges or removes.
func (p *tagPruner) isGone(id string) bool {
	_, gone := p.gone[id]
	return gone
}

// photoChanges is each photo file whose tags pruning changes, with its new
// "tags".
func (p *tagPruner) photoChanges(scan baseURLScan) ([]ScanChange, *PublishError) {
	var changes []ScanChange
	for _, f := range scan.files {
		tags := readBulkPhoto(f).tags
		if !slices.ContainsFunc(tags, p.isGone) {
			continue
		}
		pruned := p.prunedTags(tags)
		value, _ := json.MarshalIndent(pruned, "  ", "  ")
		after, err := setTopLevelList(f.content, "tags", value)
		if err != nil {
			return nil, publishErr(http.StatusConflict, "%s: %s, so nothing was changed.", f.path, err)
		}
		if !bytes.Equal(after, f.content) {
			changes = append(changes, ScanChange{Path: f.path, Before: f.content, After: after})
		}
	}
	return changes, nil
}
