package github

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"path"
	"slices"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// PhotoNotesKey is the photo file field that holds the photographer-only
// notes: text for the pipeline that the portfolio never shows, and that
// ALLPHOTOS.json leaves out.
const PhotoNotesKey = "notes"

// TagLibraryResult says where the Tag library's changes were saved: in the
// pending changes, for the next Commit.
type TagLibraryResult struct {
	pendingSave
	// Made is how many tag files were made, and Deleted how many were
	// deleted, merged, renamed or removed.
	Made    int `json:"made"`
	Deleted int `json:"deleted"`
	// Edited is how many kept tags got a new parent or description.
	Edited int `json:"edited"`
	// Photos is how many photo files had their tags or notes changed.
	Photos int `json:"photos"`
}

// ApplyTagLibrary makes every change in req, as the review left it, all as
// one save in the pending changes. Nothing is saved when a change can't be
// made or a photo file can't be read.
func (c *Client) ApplyTagLibrary(ctx context.Context, gh settings.GitHub, req TagLibrary) (TagLibraryResult, error) {
	req = cleanLibrary(req)
	if req.size() == 0 {
		return TagLibraryResult{}, publishErr(http.StatusBadRequest, "Pick at least one change to make to the tags.")
	}
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return TagLibraryResult{}, perr
	}
	if perr := allReadable(scan, "the tags weren't changed"); perr != nil {
		return TagLibraryResult{}, perr
	}
	l := newTagLibrarian(scan)
	if perr := l.run(l.steps(req, photoNames(scan))); perr != nil {
		return TagLibraryResult{}, perr
	}
	tagChanges, counts, perr := l.tagFileChanges(scan.w)
	if perr != nil {
		return TagLibraryResult{}, perr
	}
	photoChanges, perr := l.photoFileChanges(scan)
	if perr != nil {
		return TagLibraryResult{}, perr
	}
	saved, perr := c.saveFiles(scan.w, slices.Concat(tagChanges, photoChanges))
	if perr != nil {
		return TagLibraryResult{}, perr
	}
	counts.pendingSave, counts.Photos = saved, len(photoChanges)
	return counts, nil
}

// photoNames is each photo file's name, its file name without .json, by
// path.
func photoNames(scan baseURLScan) map[string]string {
	out := map[string]string{}
	for _, f := range scan.files {
		out[f.path] = strings.TrimSuffix(path.Base(f.path), path.Ext(f.path))
	}
	return out
}

// tagFileChanges is each new tag's file, each gone tag's file deleted and
// each kept tag's file with its new parent or description, sorted by path,
// counted in a TagLibraryResult.
func (l *tagLibrarian) tagFileChanges(w *workspace) ([]ScanChange, TagLibraryResult, *PublishError) {
	var changes []ScanChange
	var counts TagLibraryResult
	for _, id := range l.sortedIDs() {
		change, perr := l.tagFileChange(w, id)
		if perr != nil || change == nil {
			if perr != nil {
				return nil, counts, perr
			}
			continue
		}
		counts.count(*change, l.added[id])
		changes = append(changes, *change)
	}
	return changes, counts, nil
}

// count counts change, a tag file's, in r: made when it's new, deleted when
// it's gone, and edited otherwise.
func (r *TagLibraryResult) count(change ScanChange, made bool) {
	switch {
	case made:
		r.Made++
	case change.After == nil:
		r.Deleted++
	default:
		r.Edited++
	}
}

// tagFileChange is what the changes do to id's file, or nil when nothing.
func (l *tagLibrarian) tagFileChange(w *workspace, id string) (*ScanChange, *PublishError) {
	g := l.tags[id]
	if l.added[id] {
		return l.newTagFile(w, g)
	}
	current, _ := w.groupFile(g.Path)
	if l.isGone(id) {
		return &ScanChange{Path: g.Path, Before: current}, nil
	}
	after, err := l.editedTagFile(current, g)
	if err != nil {
		return nil, publishErr(http.StatusConflict, "%s: %s", g.Path, err)
	}
	if bytes.Equal(after, current) {
		return nil, nil
	}
	return &ScanChange{Path: g.Path, Before: current, After: after}, nil
}

// newTagFile is g's file, a new tag's, with its parent and description
// after the changes, or nil when it was merged away.
func (l *tagLibrarian) newTagFile(w *workspace, g Group) (*ScanChange, *PublishError) {
	if l.isGone(g.ID) {
		return nil, nil
	}
	if perr := w.ensureAbsent(g.Path); perr != nil {
		return nil, perr
	}
	content := groupJSON{ID: g.ID, Name: g.ID, Description: l.descriptionOf(g.ID)}
	if parent := l.parentOf(g.ID); parent != "" {
		content.Parent = &parent
	}
	b, _ := json.MarshalIndent(fileContent(Tags, content), "", "  ")
	return &ScanChange{Path: g.Path, After: append(b, '\n')}, nil
}

// editedTagFile is current, g's file, with its parent and description after
// the changes.
func (l *tagLibrarian) editedTagFile(current []byte, g Group) ([]byte, error) {
	after := current
	var err error
	if parent := l.parentOf(g.ID); parent != g.Parent {
		if after, err = setTopLevel(after, parentKey, parentValue(parent)); err != nil {
			return nil, err
		}
	}
	if d, ok := l.described[g.ID]; ok {
		return setTopLevel(after, groupDescriptionKey, []byte(quoteJSON(d)))
	}
	return after, nil
}

// photoFileChanges is each photo file whose tags or notes the changes
// change.
func (l *tagLibrarian) photoFileChanges(scan baseURLScan) ([]ScanChange, *PublishError) {
	var changes []ScanChange
	for _, f := range scan.files {
		after, err := l.photoFile(f)
		if err != nil {
			return nil, publishErr(http.StatusConflict, "%s: %s, so nothing was changed.", f.path, err)
		}
		if !bytes.Equal(after, f.content) {
			changes = append(changes, ScanChange{Path: f.path, Before: f.content, After: after})
		}
	}
	return changes, nil
}

// photoFile is f's content with its tags and notes after the changes.
func (l *tagLibrarian) photoFile(f photoFile) ([]byte, error) {
	after := f.content
	if tags := l.tagsOf(f.path); !slices.Equal(tags, l.photos[f.path]) {
		value, _ := json.MarshalIndent(tags, "  ", "  ")
		var err error
		if after, err = setTopLevelList(after, "tags", value); err != nil {
			return nil, err
		}
	}
	notes := l.notes[f.path]
	if len(notes) == 0 {
		return after, nil
	}
	text := strings.Join(slices.Concat(nonEmpty(photoNotes(f.content)), notes), "\n\n")
	return setTopLevel(after, PhotoNotesKey, []byte(quoteJSON(text)))
}

// photoNotes is the notes in content, a photo file, or "" when it has none.
func photoNotes(content []byte) string {
	var data struct {
		Notes *string `json:"notes"`
	}
	_ = json.Unmarshal(content, &data)
	return firstText(data.Notes)
}

// nonEmpty is s as a list, empty when s is "".
func nonEmpty(s string) []string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return []string{strings.TrimSpace(s)}
}
