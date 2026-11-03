package github

import (
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

// ApplyPruneTags merges, removes and reparents tags as req says, and adds
// notes to photos, all as one save in the pending changes: a merged or
// removed tag's file is deleted, the photos listing it get the tag it went
// into (or lose it), and the tags under it go under that tag (or its
// parent). Nothing is saved when a change can't be made or a photo file
// can't be read.
func (c *Client) ApplyPruneTags(ctx context.Context, gh settings.GitHub, req PruneTags, notes []PhotoNote) (PruneTagsResult, error) {
	req = cleanPrune(req)
	if req.size()+len(notes) == 0 {
		return PruneTagsResult{}, publishErr(http.StatusBadRequest, "Pick at least one change to make to the tags.")
	}
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return PruneTagsResult{}, perr
	}
	if perr := allReadable(scan, "the tags weren't changed"); perr != nil {
		return PruneTagsResult{}, perr
	}
	l := newTagLibrarian(scan)
	if perr := l.run(l.steps(TagLibrary{PruneTags: req, Notes: notes}, photoNames(scan))); perr != nil {
		return PruneTagsResult{}, perr
	}
	tagChanges, counts, perr := l.tagFileChanges(scan.w)
	if perr != nil {
		return PruneTagsResult{}, perr
	}
	photoChanges, perr := l.photoFileChanges(scan)
	if perr != nil {
		return PruneTagsResult{}, perr
	}
	saved, perr := c.saveFiles(scan.w, slices.Concat(tagChanges, photoChanges))
	if perr != nil {
		return PruneTagsResult{}, perr
	}
	return PruneTagsResult{pendingSave: saved, Deleted: counts.Deleted, Reparented: counts.Edited, Photos: len(photoChanges)}, nil
}

// allReadable fails when a photo file in scan couldn't be read, since it may
// list a tag or album that's changed. so ends its message, such as "the tags
// weren't changed".
func allReadable(scan baseURLScan, so string) *PublishError {
	for _, f := range scan.files {
		if f.err != "" {
			return publishErr(http.StatusConflict, "%s couldn't be read (%s), so %s.", f.path, f.err, so)
		}
	}
	return nil
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
