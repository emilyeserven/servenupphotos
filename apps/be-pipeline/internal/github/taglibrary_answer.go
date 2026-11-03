package github

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// tagLibraryAnswer is the JSON the Tag library prompt asks the LLM for: Tag
// pruning's changes and the rest.
type tagLibraryAnswer struct {
	pruneTagAnswer
	NewTags []struct {
		Tag         string  `json:"tag"`
		Description string  `json:"description"`
		Parent      *string `json:"parent"`
		Reason      string  `json:"reason"`
	} `json:"newTags"`
	Rename []struct {
		Tag    string `json:"tag"`
		To     string `json:"to"`
		Reason string `json:"reason"`
	} `json:"rename"`
	Describe []struct {
		Tag         string `json:"tag"`
		Description string `json:"description"`
	} `json:"describe"`
	Photos []struct {
		Photo  string   `json:"photo"`
		Add    []string `json:"add"`
		Remove []string `json:"remove"`
		Reason string   `json:"reason"`
	} `json:"photos"`
}

// size is how many changes a asks for.
func (a tagLibraryAnswer) size() int {
	return len(a.Merge) + len(a.Remove) + len(a.Reparent) + len(a.NewTags) + len(a.Rename) + len(a.Describe) + len(a.Photos) + len(a.Notes)
}

// parseTagLibraryAnswer reads the JSON object in text, the LLM's answer,
// which may be inside a code block or have words around it.
func parseTagLibraryAnswer(text string) (tagLibraryAnswer, *PublishError) {
	var answer tagLibraryAnswer
	start, end := strings.Index(text, "{"), strings.LastIndex(text, "}")
	if start < 0 || end < start {
		return answer, publishErr(http.StatusBadRequest, "Paste the LLM's whole answer: the JSON object it wrote, from { to }.")
	}
	if err := json.Unmarshal([]byte(text[start:end+1]), &answer); err != nil {
		return answer, publishErr(http.StatusBadRequest, "The answer isn't the JSON the prompt asks for (%v). Ask the LLM to answer with only that JSON.", err)
	}
	if answer.size() == 0 {
		return answer, publishErr(http.StatusBadRequest, "The answer doesn't suggest any changes, so the tags are fine as they are.")
	}
	return answer, nil
}

// TagLibraryNewTag is a tag the answer makes.
type TagLibraryNewTag struct {
	Tag         string `json:"tag"`
	Description string `json:"description"`
	// Parent is the tag it goes under, or "" for the top level.
	Parent string `json:"parent"`
	Reason string `json:"reason"`
}

// TagLibraryRename is a tag the answer gives a new ID, keeping its photos,
// description and the tags under it.
type TagLibraryRename struct {
	Tag    string `json:"tag"`
	To     string `json:"to"`
	Reason string `json:"reason"`
	// Photos is how many photo files list Tag.
	Photos int `json:"photos"`
}

// TagLibraryDescribe is a new description the answer gives a tag.
type TagLibraryDescribe struct {
	Tag string `json:"tag"`
	// From is its description now, "" when it has none.
	From        string `json:"from"`
	Description string `json:"description"`
}

// TagLibraryPhotoEdit is the tags the answer adds to and takes off one
// photo, as they'll change after the tag changes before them.
type TagLibraryPhotoEdit struct {
	Photo  string   `json:"photo"`
	Path   string   `json:"path"`
	Add    []string `json:"add"`
	Remove []string `json:"remove"`
	Reason string   `json:"reason"`
	// Tags is the photo's tags now.
	Tags []string `json:"tags"`
}

// TagLibraryNote is a note the answer adds to one photo's photographer-only
// notes.
type TagLibraryNote struct {
	Photo string `json:"photo"`
	Path  string `json:"path"`
	Note  string `json:"note"`
}

// TagLibraryFewPhotos is a tag that would have fewer photos than a tag
// should after every change in the answer.
type TagLibraryFewPhotos struct {
	Tag    string `json:"tag"`
	Photos int    `json:"photos"`
	// Parent is the tag it's under, "" at the top level.
	Parent string `json:"parent"`
}

// TagLibraryPreview is what pasting the LLM's answer would do to the whole
// tag library, each change checked against the ones before it.
type TagLibraryPreview struct {
	// Tags and Photos are how many tags and readable photo files there are.
	Tags     int                   `json:"tags"`
	Photos   int                   `json:"photos"`
	NewTags  []TagLibraryNewTag    `json:"newTags"`
	Rename   []TagLibraryRename    `json:"rename"`
	Merge    []PruneTagMerge       `json:"merge"`
	Remove   []PruneTagRemoval     `json:"remove"`
	Reparent []PruneTagReparent    `json:"reparent"`
	Describe []TagLibraryDescribe  `json:"describe"`
	Edits    []TagLibraryPhotoEdit `json:"edits"`
	Notes    []TagLibraryNote      `json:"notes"`
	// FewPhotos is every tag left with fewer than MinPhotos photos.
	FewPhotos []TagLibraryFewPhotos `json:"fewPhotos"`
	// MinPhotos is the fewest photos a tag should have.
	MinPhotos int               `json:"minPhotos"`
	Skipped   []PruneTagSkipped `json:"skipped"`
}

// libraryLookup turns the answer's tag and photo names into IDs and paths.
type libraryLookup struct {
	tags tagLookup
	// photos is each photo's path, by its name and its file name.
	photos map[string]string
}

// newLibraryLookup is a libraryLookup for l's tags and scan's photos.
func newLibraryLookup(l *tagLibrarian, scan baseURLScan) libraryLookup {
	out := libraryLookup{tags: newTagLookup(l.tags), photos: map[string]string{}}
	for p, name := range photoNames(scan) {
		out.photos[name], out.photos[name+".json"] = p, p
	}
	return out
}

// newID is the ID the answer means for a tag it makes: an existing tag's,
// or else the ID made from name. It's added to the lookup, so the rest of
// the answer finds it.
func (lk libraryLookup) newID(name string) string {
	clean := cleanTagName(name)
	if id := tagID(clean); id != "" {
		lk.tags[strings.ToLower(clean)], lk.tags[id] = id, id
		return id
	}
	return clean
}

// photo is the path of the photo the answer names, or the name itself when
// it's no photo, so the review says so.
func (lk libraryLookup) photo(name string) string {
	clean := strings.TrimSpace(name)
	if p, ok := lk.photos[clean]; ok {
		return p
	}
	return clean
}

// ids is names as tag IDs.
func (lk libraryLookup) ids(names []string) []string {
	out := make([]string, 0, len(names))
	for _, n := range names {
		out = append(out, lk.tags.id(n))
	}
	return out
}

// request is answer as a TagLibrary of tag IDs and photo paths, with each
// change's reason by kind, in the same order.
func (lk libraryLookup) request(answer tagLibraryAnswer) (TagLibrary, map[string][]string) {
	var req TagLibrary
	reasons := map[string][]string{}
	for _, t := range answer.NewTags {
		req.NewTags = append(req.NewTags, NewGroup{ID: lk.newID(t.Tag), Description: strings.TrimSpace(t.Description), Parent: lk.tags.parent(t.Parent)})
		reasons[libraryNew] = append(reasons[libraryNew], strings.TrimSpace(t.Reason))
	}
	for _, r := range answer.Rename {
		req.Rename = append(req.Rename, TagRename{Tag: lk.tags.id(r.Tag), To: lk.newID(r.To)})
		reasons[libraryRename] = append(reasons[libraryRename], strings.TrimSpace(r.Reason))
	}
	prune, pruneReasons := lk.tags.request(answer.pruneTagAnswer)
	req.PruneTags = prune
	for k, v := range pruneReasons {
		reasons[k] = v
	}
	for _, d := range answer.Describe {
		req.Describe = append(req.Describe, TagDescribe{Tag: lk.tags.id(d.Tag), Description: d.Description})
	}
	for _, p := range answer.Photos {
		req.Photos = append(req.Photos, TagLibraryPhoto{Path: lk.photo(p.Photo), Add: lk.ids(p.Add), Remove: lk.ids(p.Remove)})
		reasons[libraryPhotos] = append(reasons[libraryPhotos], strings.TrimSpace(p.Reason))
	}
	req.Notes = lk.notes(answer.pruneTagAnswer)
	return req, reasons
}

// notes is the answer's notes, by photo path.
func (lk libraryLookup) notes(answer pruneTagAnswer) []PhotoNote {
	var out []PhotoNote
	for _, n := range answer.Notes {
		out = append(out, PhotoNote{Path: lk.photo(n.Photo), Note: n.Note})
	}
	return out
}

// noteListed is n as the review lists it.
func noteListed(n PhotoNote, names map[string]string) TagLibraryNote {
	return TagLibraryNote{Photo: names[n.Path], Path: n.Path, Note: strings.TrimSpace(n.Note)}
}

// PreviewTagLibrary reads answer, the LLM's JSON with changes to the whole
// tag library and each photo's tags, and says what each change would do,
// and which can't be made and why. It only reads.
func (c *Client) PreviewTagLibrary(ctx context.Context, gh settings.GitHub, answer string) (TagLibraryPreview, error) {
	parsed, perr := parseTagLibraryAnswer(answer)
	if perr != nil {
		return TagLibraryPreview{}, perr
	}
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return TagLibraryPreview{}, perr
	}
	l := newTagLibrarian(scan)
	req, reasons := newLibraryLookup(l, scan).request(parsed)
	preview := emptyLibraryPreview(len(l.tags), len(l.photos))
	names := photoNames(scan)
	counts := tagCounts(scan)
	for _, s := range l.steps(req, names) {
		before := l.stepBefore(req, s)
		if why := s.run(); why != "" {
			preview.Skipped = append(preview.Skipped, PruneTagSkipped{Change: s.said, Reason: why})
			continue
		}
		preview.add(l, req, s, at(reasons[s.kind], s.index), counts, names, before)
	}
	preview.FewPhotos = l.fewPhotos()
	return preview, nil
}

// emptyLibraryPreview is a TagLibraryPreview of tags tags and photos photos
// with every list empty rather than null.
func emptyLibraryPreview(tags, photos int) TagLibraryPreview {
	return TagLibraryPreview{
		Tags: tags, Photos: photos, MinPhotos: minTagPhotos,
		NewTags: []TagLibraryNewTag{}, Rename: []TagLibraryRename{}, Merge: []PruneTagMerge{},
		Remove: []PruneTagRemoval{}, Reparent: []PruneTagReparent{}, Describe: []TagLibraryDescribe{},
		Edits: []TagLibraryPhotoEdit{}, Notes: []TagLibraryNote{}, FewPhotos: []TagLibraryFewPhotos{},
		Skipped: []PruneTagSkipped{},
	}
}

// at is list's i'th item, or "" past its end.
func at(list []string, i int) string {
	if i < len(list) {
		return list[i]
	}
	return ""
}

// stepBefore is what the review needs from before s runs: the parent of a
// reparented tag, the description of a described one, or a photo's tags as
// a comma-separated list.
func (l *tagLibrarian) stepBefore(req TagLibrary, s pruneStep) string {
	switch s.kind {
	case pruneReparent:
		return l.parentOf(req.Reparent[s.index].Tag)
	case libraryDescribe:
		return l.descriptionOf(req.Describe[s.index].Tag)
	case libraryPhotos:
		return strings.Join(l.tagsOf(req.Photos[s.index].Path), ",")
	}
	return ""
}

// add lists s, a change that can be made, with the answer's reason for it.
// before is what stepBefore said.
func (pv *TagLibraryPreview) add(l *tagLibrarian, req TagLibrary, s pruneStep, reason string, counts map[string]int, names map[string]string, before string) {
	switch s.kind {
	case libraryNew:
		t := l.tags[req.NewTags[s.index].ID]
		pv.NewTags = append(pv.NewTags, TagLibraryNewTag{Tag: t.ID, Description: t.Description, Parent: t.Parent, Reason: reason})
	case libraryRename:
		r := req.Rename[s.index]
		pv.Rename = append(pv.Rename, TagLibraryRename{Tag: r.Tag, To: r.To, Reason: reason, Photos: counts[r.Tag]})
	case libraryDescribe:
		d := req.Describe[s.index]
		pv.Describe = append(pv.Describe, TagLibraryDescribe{Tag: d.Tag, From: before, Description: l.described[d.Tag]})
	case libraryPhotos:
		pv.Edits = append(pv.Edits, photoEdit(l, req.Photos[s.index], names, before, reason))
	case libraryNotes:
		pv.Notes = append(pv.Notes, noteListed(req.Notes[s.index], names))
	default:
		pv.addPrune(l, req.PruneTags, s, reason, counts, before)
	}
}

// addPrune lists s, one of Tag pruning's changes, as PruneTagsPreview.add
// does.
func (pv *TagLibraryPreview) addPrune(l *tagLibrarian, req PruneTags, s pruneStep, reason string, counts map[string]int, before string) {
	var prune PruneTagsPreview
	prune.add(l.tagPruner, req, s, reason, counts, before)
	pv.Merge = append(pv.Merge, prune.Merge...)
	pv.Remove = append(pv.Remove, prune.Remove...)
	pv.Reparent = append(pv.Reparent, prune.Reparent...)
}

// photoEdit is e as the review lists it: only the tags it really adds and
// takes off, given before, the photo's tags before it as a comma-separated
// list.
func photoEdit(l *tagLibrarian, e TagLibraryPhoto, names map[string]string, before, reason string) TagLibraryPhotoEdit {
	had := strings.Split(before, ",")
	if before == "" {
		had = []string{}
	}
	now := l.tagsOf(e.Path)
	out := TagLibraryPhotoEdit{Photo: names[e.Path], Path: e.Path, Reason: reason, Tags: had, Add: []string{}, Remove: []string{}}
	for _, t := range now {
		if !slices.Contains(had, t) {
			out.Add = append(out.Add, t)
		}
	}
	for _, t := range had {
		if !slices.Contains(now, t) {
			out.Remove = append(out.Remove, t)
		}
	}
	return out
}

// fewPhotos is every kept tag that has fewer than minTagPhotos photos after
// the changes, sorted by ID.
func (l *tagLibrarian) fewPhotos() []TagLibraryFewPhotos {
	out := []TagLibraryFewPhotos{}
	counts := l.photoCounts()
	for _, id := range l.sortedIDs() {
		if n, kept := counts[id]; kept && n < minTagPhotos {
			out = append(out, TagLibraryFewPhotos{Tag: id, Photos: n, Parent: l.parentOf(id)})
		}
	}
	return out
}
