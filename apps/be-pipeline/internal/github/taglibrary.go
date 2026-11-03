package github

import (
	"fmt"
	"net/http"
	"slices"
	"strings"
	"unicode/utf8"
)

// minTagPhotos is the fewest photos a tag should have. A tag with fewer is
// listed in the Tag library review, and the prompts ask for a note on the
// photos instead of a tag.
const minTagPhotos = 3

// TagRename gives Tag the new ID To: a tag To is made with Tag's description
// and parent, and Tag is merged into it.
type TagRename struct {
	Tag string `json:"tag"`
	To  string `json:"to"`
}

// TagDescribe gives Tag the description Description.
type TagDescribe struct {
	Tag         string `json:"tag"`
	Description string `json:"description"`
}

// TagLibraryPhoto is the tags to add to and take off one photo file, by ID.
type TagLibraryPhoto struct {
	Path   string   `json:"path"`
	Add    []string `json:"add"`
	Remove []string `json:"remove"`
}

// PhotoNote is a note to add to one photo file's photographer-only notes.
type PhotoNote struct {
	Path string `json:"path"`
	Note string `json:"note"`
}

// TagLibrary is what the Tag library saves, as the review left it: new tags,
// renames, the changes Tag pruning makes, new descriptions, each photo's tag
// changes, and notes for the photos.
type TagLibrary struct {
	// NewTags are the tags to make, by ID; a tag's name is its ID.
	NewTags []NewGroup  `json:"newTags"`
	Rename  []TagRename `json:"rename"`
	PruneTags
	Describe []TagDescribe     `json:"describe"`
	Photos   []TagLibraryPhoto `json:"photos"`
	Notes    []PhotoNote       `json:"notes"`
}

// size is how many changes l asks for.
func (l TagLibrary) size() int {
	return len(l.NewTags) + len(l.Rename) + l.PruneTags.size() + len(l.Describe) + len(l.Photos) + len(l.Notes)
}

// maxPhotoNote is the longest note, in characters, added to a photo at once.
const maxPhotoNote = 2000

// tagLibrarian works out what the Tag library's changes do, one at a time,
// so each is checked against the ones before it. Its tagPruner has the new
// tags in it too.
type tagLibrarian struct {
	*tagPruner
	// root is the data folder, where new tag files go.
	root string
	// groups is every album, tag and genre by kind folder, new tags too, so
	// a new tag's ID can't be another's.
	groups map[string][]Group
	// added is the new tags' IDs.
	added map[string]bool
	// described is the new descriptions, by tag ID.
	described map[string]string
	// photos is each readable photo file's tags as read, by path.
	photos map[string][]string
	// photoTags is each edited photo's tags after its edits, by path.
	photoTags map[string][]string
	// notes is the notes to add to each photo, by path.
	notes map[string][]string
}

// newTagLibrarian is a tagLibrarian for scan's tags and photos.
func newTagLibrarian(scan baseURLScan) *tagLibrarian {
	groups := scan.w.groups()
	l := &tagLibrarian{
		tagPruner: newTagPruner(groups[Tags.Folder]), root: scan.w.root, groups: groups,
		added: map[string]bool{}, described: map[string]string{}, photos: map[string][]string{},
		photoTags: map[string][]string{}, notes: map[string][]string{},
	}
	for _, f := range scan.files {
		if f.err == "" {
			l.photos[f.path] = readBulkPhoto(f).tags
		}
	}
	return l
}

// newTag makes t, or says why it can't.
func (l *tagLibrarian) newTag(t NewGroup) string {
	t.Name = t.ID
	content, perr := validGroup(Tags, NewGroup{ID: t.ID, Name: t.ID, Description: t.Description})
	if perr == nil {
		perr = checkCollision(l.groups, t)
	}
	if perr != nil {
		return strings.TrimSuffix(perr.Message, ".")
	}
	if t.Parent != "" {
		if why := l.kept(t.Parent); why != "" {
			return why
		}
	}
	g := Group{ID: content.ID, Name: content.ID, Description: content.Description, Parent: t.Parent, Path: l.root + "/" + Tags.Folder + "/" + content.ID + ".json"}
	l.tags[g.ID], l.added[g.ID] = g, true
	l.groups[Tags.Folder] = append(l.groups[Tags.Folder], g)
	return ""
}

// rename gives r.Tag the ID r.To, or says why it can't.
func (l *tagLibrarian) rename(r TagRename) string {
	if why := l.kept(r.Tag); why != "" {
		return why
	}
	old := l.tags[r.Tag]
	if why := l.newTag(NewGroup{ID: r.To, Description: l.descriptionOf(r.Tag), Parent: l.parentOf(r.Tag)}); why != "" {
		return why
	}
	if why := l.merge(TagMerge{Tag: old.ID, Into: r.To}); why != "" {
		l.dropNew(r.To)
		return why
	}
	return ""
}

// dropNew takes id, a tag newTag just made, away again.
func (l *tagLibrarian) dropNew(id string) {
	delete(l.tags, id)
	delete(l.added, id)
	l.groups[Tags.Folder] = slices.DeleteFunc(l.groups[Tags.Folder], func(g Group) bool { return g.ID == id })
}

// descriptionOf is id's description after the changes.
func (l *tagLibrarian) descriptionOf(id string) string {
	if d, ok := l.described[id]; ok {
		return d
	}
	return l.tags[id].Description
}

// describe gives d.Tag the description d.Description, or says why it can't.
func (l *tagLibrarian) describe(d TagDescribe) string {
	if why := l.kept(d.Tag); why != "" {
		return why
	}
	text := strings.TrimSpace(d.Description)
	switch {
	case text == "":
		return "the description is empty"
	case utf8.RuneCountInString(text) > maxTagDescription:
		return fmt.Sprintf("the description is longer than %d characters", maxTagDescription)
	case text == l.descriptionOf(d.Tag):
		return "it has that description already"
	}
	l.described[d.Tag] = text
	return ""
}

// tagsOf is the tags of the photo file at path after the changes so far.
func (l *tagLibrarian) tagsOf(path string) []string {
	if tags, ok := l.photoTags[path]; ok {
		return tags
	}
	return l.prunedTags(l.photos[path])
}

// photoTagOf is what id becomes on a photo, or why it can't go on one.
func (l *tagLibrarian) photoTagOf(id string) (string, string) {
	if _, ok := l.tags[id]; !ok {
		return "", fmt.Sprintf("%q isn't a tag", id)
	}
	if t := l.photoTag(id); t != "" {
		return t, ""
	}
	return "", fmt.Sprintf("%q is removed", id)
}

// editPhoto adds and takes off e's tags, or says why it can't.
func (l *tagLibrarian) editPhoto(e TagLibraryPhoto) string {
	if _, ok := l.photos[e.Path]; !ok {
		return "it isn't a readable photo file"
	}
	tags := slices.Clone(l.tagsOf(e.Path))
	for _, id := range e.Remove {
		t, why := l.photoTagOf(id)
		if why != "" {
			return why
		}
		tags = slices.DeleteFunc(tags, func(s string) bool { return s == t })
	}
	for _, id := range e.Add {
		t, why := l.photoTagOf(id)
		if why != "" {
			return why
		}
		if !slices.Contains(tags, t) {
			tags = append(tags, t)
		}
	}
	if slices.Equal(tags, l.tagsOf(e.Path)) {
		return "it has those tags already"
	}
	l.photoTags[e.Path] = tags
	return ""
}

// note adds n to its photo's notes, or says why it can't.
func (l *tagLibrarian) note(n PhotoNote) string {
	if _, ok := l.photos[n.Path]; !ok {
		return "it isn't a readable photo file"
	}
	text := strings.TrimSpace(n.Note)
	switch {
	case text == "":
		return "the note is empty"
	case utf8.RuneCountInString(text) > maxPhotoNote:
		return fmt.Sprintf("the note is longer than %d characters", maxPhotoNote)
	}
	l.notes[n.Path] = append(l.notes[n.Path], text)
	return ""
}

// photoCounts is how many photos have each kept tag after the changes, by ID.
func (l *tagLibrarian) photoCounts() map[string]int {
	out := map[string]int{}
	for id := range l.tags {
		if !l.isGone(id) {
			out[id] = 0
		}
	}
	for path := range l.photos {
		for _, id := range l.tagsOf(path) {
			out[id]++
		}
	}
	return out
}

// The lists of a TagLibrary beyond a PruneTags', as pruneStep.kind names
// them.
const (
	libraryNew      = "newTags"
	libraryRename   = "rename"
	libraryDescribe = "describe"
	libraryPhotos   = "photos"
	libraryNotes    = "notes"
)

// steps is req's changes in the order they're checked: new tags first, so
// the rest can use them, then renames, Tag pruning's changes, descriptions,
// each photo's tags and the notes. names is each photo's name, by path.
func (l *tagLibrarian) steps(req TagLibrary, names map[string]string) []pruneStep {
	var out []pruneStep
	for i, t := range req.NewTags {
		out = append(out, pruneStep{libraryNew, i, "make " + t.ID, func() string { return l.newTag(t) }})
	}
	for i, r := range req.Rename {
		out = append(out, pruneStep{libraryRename, i, fmt.Sprintf("rename %s to %s", r.Tag, r.To), func() string { return l.rename(r) }})
	}
	out = append(out, l.tagPruner.steps(req.PruneTags)...)
	for i, d := range req.Describe {
		out = append(out, pruneStep{libraryDescribe, i, "describe " + d.Tag, func() string { return l.describe(d) }})
	}
	for i, e := range req.Photos {
		out = append(out, pruneStep{libraryPhotos, i, "change the tags of " + nameOr(names, e.Path), func() string { return l.editPhoto(e) }})
	}
	for i, n := range req.Notes {
		out = append(out, pruneStep{libraryNotes, i, "add a note to " + nameOr(names, n.Path), func() string { return l.note(n) }})
	}
	return out
}

// nameOr is path's photo name in names, or path itself.
func nameOr(names map[string]string, path string) string {
	if n, ok := names[path]; ok {
		return n
	}
	return path
}

// run runs every step, failing at the first that can't be made.
func (l *tagLibrarian) run(steps []pruneStep) *PublishError {
	for _, s := range steps {
		if why := s.run(); why != "" {
			return publishErr(http.StatusConflict, "Couldn't %s: %s. Nothing was changed.", s.said, why)
		}
	}
	return nil
}

// cleanLibrary is req with every ID and path trimmed.
func cleanLibrary(req TagLibrary) TagLibrary {
	out := TagLibrary{PruneTags: cleanPrune(req.PruneTags), Describe: req.Describe, Notes: req.Notes}
	for _, t := range req.NewTags {
		out.NewTags = append(out.NewTags, NewGroup{ID: strings.TrimSpace(t.ID), Description: strings.TrimSpace(t.Description), Parent: strings.TrimSpace(t.Parent)})
	}
	for _, r := range req.Rename {
		out.Rename = append(out.Rename, TagRename{Tag: strings.TrimSpace(r.Tag), To: strings.TrimSpace(r.To)})
	}
	for i := range out.Describe {
		out.Describe[i].Tag = strings.TrimSpace(out.Describe[i].Tag)
	}
	for _, p := range req.Photos {
		out.Photos = append(out.Photos, TagLibraryPhoto{Path: strings.TrimSpace(p.Path), Add: trimAll(p.Add), Remove: trimAll(p.Remove)})
	}
	return out
}

// trimAll is ids, each trimmed.
func trimAll(ids []string) []string {
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		out = append(out, strings.TrimSpace(id))
	}
	return out
}
