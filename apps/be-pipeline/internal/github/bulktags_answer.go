package github

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// bulkTagAnswer is the JSON the Bulk Tagging prompt asks the LLM for.
type bulkTagAnswer struct {
	Photos []struct {
		// Photo is the photo's name, as the prompt lists it.
		Photo string   `json:"photo"`
		Tags  []string `json:"tags"`
	} `json:"photos"`
	Definitions []struct {
		Tag        string `json:"tag"`
		Definition string `json:"definition"`
		// Parent is the more general tag a local term belongs under.
		Parent string `json:"parent"`
	} `json:"definitions"`
}

// parseLLMAnswer reads the JSON object in text, an LLM's answer, into
// answer. The object may be inside a code block or have words around it.
func parseLLMAnswer(text string, answer any) *PublishError {
	start, end := strings.Index(text, "{"), strings.LastIndex(text, "}")
	if start < 0 || end < start {
		return publishErr(http.StatusBadRequest, "Paste the LLM's whole answer: the JSON object it wrote, from { to }.")
	}
	if err := json.Unmarshal([]byte(text[start:end+1]), answer); err != nil {
		return publishErr(http.StatusBadRequest, "The answer isn't the JSON the prompt asks for (%v). Ask the LLM to answer with only that JSON.", err)
	}
	return nil
}

// parseBulkTagAnswer reads the Bulk Tagging JSON in text, the LLM's answer.
func parseBulkTagAnswer(text string) (bulkTagAnswer, *PublishError) {
	var answer bulkTagAnswer
	if perr := parseLLMAnswer(text, &answer); perr != nil {
		return answer, perr
	}
	if len(answer.Photos) == 0 {
		return answer, publishErr(http.StatusBadRequest, "The answer has no photos in it. Ask the LLM to answer with tags for each photo.")
	}
	return answer, nil
}

// BulkTagSkipped is a name in the answer that can't be a tag (or, for Genre
// Suggestions, a genre), with why.
type BulkTagSkipped struct {
	Name   string `json:"name"`
	Reason string `json:"reason"`
}

// BulkTagPhotoPlan is what the answer adds to one photo: tags for Bulk
// Tagging, genres for Genre Suggestions.
type BulkTagPhotoPlan struct {
	Path string `json:"path"`
	Name string `json:"name"`
	// Add is the IDs of the tags (or genres) to add to it, existing and new,
	// in the answer's order.
	Add []string `json:"add"`
	// Already is the IDs of the ones the answer names that it already has.
	Already []string         `json:"already"`
	Skipped []BulkTagSkipped `json:"skipped"`
}

// BulkTagNew is a tag the answer names that isn't one yet.
type BulkTagNew struct {
	ID          string `json:"id"`
	Description string `json:"description"`
	// Parent is the ID of the more general tag the answer puts it under, or
	// "" for none.
	Parent string `json:"parent"`
	// ParentOnly is true for a tag made only to be another new tag's parent.
	ParentOnly bool `json:"parentOnly"`
}

// BulkTagsPreview is what pasting the LLM's answer would do: the tags each
// photo gets and the new tags to make.
type BulkTagsPreview struct {
	Photos  []BulkTagPhotoPlan `json:"photos"`
	NewTags []BulkTagNew       `json:"newTags"`
	// Unknown is the photos in the answer that aren't any of the picked ones.
	Unknown []string `json:"unknown"`
}

// groupNamer sorts the names in an answer into existing tags (or genres), new
// ones and ones that can't be used, as pasting into a photo's Tags field does.
// The new tags and their definitions are kept for Bulk Tagging.
type groupNamer struct {
	own      map[string]string // ID or lowercase name → ID, of the kind being named
	taken    map[string]string // ID or lowercase name of another kind's group or a metadata group → why
	defs     map[string]BulkTagNew
	newOrder []string
}

// newGroupNamer is a groupNamer for kind, among groups and the metadata
// groups in meta.
func newGroupNamer(kind Kind, groups map[string][]Group, meta []Entry) *groupNamer {
	n := &groupNamer{own: map[string]string{}, taken: map[string]string{}, defs: map[string]BulkTagNew{}}
	for _, g := range groups[kind.Folder] {
		if g.Error == "" {
			n.own[g.ID], n.own[strings.ToLower(strings.TrimSpace(g.Name))] = g.ID, g.ID
		}
	}
	for _, k := range kinds {
		if k == kind {
			continue
		}
		for _, g := range groups[k.Folder] {
			n.taken[g.ID], n.taken[strings.ToLower(strings.TrimSpace(g.Name))] = "a "+k.Name+" has that name", "a "+k.Name+" has that name"
		}
	}
	for _, e := range meta {
		var m MetaGroup
		if json.Unmarshal(e.Data, &m) == nil && m.Name != "" {
			n.taken[strings.ToLower(strings.TrimSpace(m.Name))] = "a metadata group has that name"
		}
	}
	return n
}

// sort says what name is: an existing tag's (or genre's) ID, a new one's ID,
// or why it can't be one.
func (n *groupNamer) sort(name string) (id string, fresh bool, reason string) {
	name = cleanTagName(name)
	if id, ok := n.own[strings.ToLower(name)]; ok {
		return id, false, ""
	}
	id = tagID(name)
	if existing, ok := n.own[id]; ok {
		return existing, false, ""
	}
	if id == "" {
		return "", false, "it has no letter or number from a to z or 0 to 9 to make an ID from"
	}
	if why, ok := n.taken[strings.ToLower(name)]; ok {
		return "", false, why
	}
	if why, ok := n.taken[id]; ok {
		return "", false, why
	}
	return id, true, ""
}

// cleanTagName is name with its surrounding spaces, quotes and "#" taken off.
func cleanTagName(name string) string {
	return strings.Trim(strings.TrimSpace(name), "\"'“”‘’#. ")
}

// accents turns the accented Latin letters an LLM might write into plain ones,
// as the app's groupId drops accents.
var accents = strings.NewReplacer(
	"à", "a", "á", "a", "â", "a", "ã", "a", "ä", "a", "å", "a", "ā", "a",
	"ç", "c", "è", "e", "é", "e", "ê", "e", "ë", "e", "ē", "e",
	"ì", "i", "í", "i", "î", "i", "ï", "i", "ī", "i", "ñ", "n",
	"ò", "o", "ó", "o", "ô", "o", "õ", "o", "ö", "o", "ō", "o",
	"ù", "u", "ú", "u", "û", "u", "ü", "u", "ū", "u", "ý", "y", "ÿ", "y",
)

// tagID is name as a tag ID, in lowercase kebab-case, as the app's groupId
// makes one: accents dropped and runs of anything else turned into one dash.
// It's "" when name has no letter or number from a to z or 0 to 9.
func tagID(name string) string {
	var b strings.Builder
	dash := false
	for _, r := range accents.Replace(strings.ToLower(name)) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			if dash && b.Len() > 0 {
				b.WriteByte('-')
			}
			b.WriteRune(r)
			dash = false
			continue
		}
		dash = true
	}
	id := b.String()
	if len(id) > maxGroupIDLength {
		id = strings.TrimRight(id[:maxGroupIDLength], "-")
	}
	return id
}

// addNew lists id as a new tag, once, with the answer's definition of it.
func (n *groupNamer) addNew(id string, def BulkTagNew) {
	if _, ok := n.defs[id]; ok {
		return
	}
	def.ID = id
	n.defs[id] = def
	n.newOrder = append(n.newOrder, id)
}

// definitions reads the answer's definitions by the ID each defined tag gets.
func (n *groupNamer) definitions(answer bulkTagAnswer) map[string]BulkTagNew {
	out := map[string]BulkTagNew{}
	for _, d := range answer.Definitions {
		if id := tagID(cleanTagName(d.Tag)); id != "" {
			out[id] = BulkTagNew{Description: strings.TrimSpace(d.Definition), Parent: strings.TrimSpace(d.Parent)}
		}
	}
	return out
}

// newTags is the new tags, each parent that isn't a tag yet first, made only
// to be under it, with the answer's definitions as their descriptions.
func (n *groupNamer) newTags() []BulkTagNew {
	var parents, children []BulkTagNew
	for _, id := range n.newOrder {
		def := n.defs[id]
		def.Parent = n.parentOf(def)
		if n.isMissing(def.Parent) && !slices.ContainsFunc(parents, func(p BulkTagNew) bool { return p.ID == def.Parent }) {
			parents = append(parents, BulkTagNew{ID: def.Parent, ParentOnly: true})
		}
		children = append(children, def)
	}
	slices.SortStableFunc(children, func(a, b BulkTagNew) int { return n.parentRank(b, children) - n.parentRank(a, children) })
	return append(parents, children...)
}

// isMissing is whether id, a parent's ID, is neither a tag nor a new one.
func (n *groupNamer) isMissing(id string) bool {
	_, isTag := n.own[id]
	_, isNew := n.defs[id]
	return id != "" && !isTag && !isNew
}

// parentOf is the ID of the tag def says it goes under, or "" when it gives
// none, or one that can't be a tag or is itself.
func (n *groupNamer) parentOf(def BulkTagNew) string {
	if def.Parent == "" {
		return ""
	}
	id, _, reason := n.sort(def.Parent)
	if reason != "" || id == def.ID {
		return ""
	}
	return id
}

// parentRank is 1 when t is another new tag's parent, so it's made first.
func (n *groupNamer) parentRank(t BulkTagNew, all []BulkTagNew) int {
	if slices.ContainsFunc(all, func(o BulkTagNew) bool { return o.Parent == t.ID }) {
		return 1
	}
	return 0
}

// PreviewBulkTags reads answer, the LLM's JSON for the photos at paths (as
// PickBulkTagPhotos picked them), and says which tags each would get, which
// are new and which can't be tags. It only reads.
func (c *Client) PreviewBulkTags(ctx context.Context, gh settings.GitHub, paths []string, answer string) (BulkTagsPreview, error) {
	parsed, perr := parseBulkTagAnswer(answer)
	if perr != nil {
		return BulkTagsPreview{}, perr
	}
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return BulkTagsPreview{}, perr
	}
	photos, perr := picked(scan, paths)
	if perr != nil {
		return BulkTagsPreview{}, perr
	}
	n := newGroupNamer(Tags, scan.w.groups(), scan.w.entries(MetaInfo))
	defs := n.definitions(parsed)
	preview := BulkTagsPreview{Photos: []BulkTagPhotoPlan{}, Unknown: []string{}}
	for _, p := range photos {
		preview.Photos = append(preview.Photos, n.plan(p, parsed, defs))
	}
	for _, a := range parsed.Photos {
		if !slices.ContainsFunc(photos, func(p bulkPhoto) bool { return p.name == strings.TrimSpace(a.Photo) }) {
			preview.Unknown = append(preview.Unknown, a.Photo)
		}
	}
	preview.NewTags = append([]BulkTagNew{}, n.newTags()...)
	return preview, nil
}

// picked is the readable photo files at paths, in that order.
func picked(scan baseURLScan, paths []string) ([]bulkPhoto, *PublishError) {
	if len(paths) == 0 || len(paths) > maxBulkTagPhotos {
		return nil, publishErr(http.StatusBadRequest, "Pick 1 to %d photos.", maxBulkTagPhotos)
	}
	var out []bulkPhoto
	for _, p := range paths {
		i := slices.IndexFunc(scan.files, func(f photoFile) bool { return f.path == p })
		if i < 0 {
			return nil, publishErr(http.StatusNotFound, "%s isn't a photo file on %s. Pick the photos again.", p, scan.branch)
		}
		if f := scan.files[i]; f.err != "" {
			return nil, publishErr(http.StatusConflict, "%s couldn't be read (%s).", p, f.err)
		}
		out = append(out, readBulkPhoto(scan.files[i]))
	}
	return out, nil
}

// plan is the tags the answer gives p.
func (n *groupNamer) plan(p bulkPhoto, answer bulkTagAnswer, defs map[string]BulkTagNew) BulkTagPhotoPlan {
	var names []string
	for _, a := range answer.Photos {
		if strings.TrimSpace(a.Photo) == p.name {
			names = append(names, a.Tags...)
		}
	}
	return n.planNames(p, p.tags, names, func(id, _ string) { n.addNew(id, defs[id]) })
}

// planNames is what names, the answer's names for p, add to it, where have
// is the IDs it lists already. onFresh is told each new ID and the name it
// was made from, every time one comes up.
func (n *groupNamer) planNames(p bulkPhoto, have, names []string, onFresh func(id, name string)) BulkTagPhotoPlan {
	plan := BulkTagPhotoPlan{Path: p.file.path, Name: p.name, Add: []string{}, Already: []string{}, Skipped: []BulkTagSkipped{}}
	for _, name := range names {
		id, fresh, reason := n.sort(name)
		switch {
		case reason != "":
			plan.Skipped = append(plan.Skipped, BulkTagSkipped{Name: cleanTagName(name), Reason: reason})
		case slices.Contains(have, id):
			plan.Already = appendMissing(plan.Already, []string{id})
		default:
			plan.Add = appendMissing(plan.Add, []string{id})
		}
		if fresh {
			onFresh(id, cleanTagName(name))
		}
	}
	return plan
}
