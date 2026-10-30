package github

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// pruneTagAnswer is the JSON the Tag pruning prompt asks the LLM for.
type pruneTagAnswer struct {
	Merge []struct {
		Tag    string `json:"tag"`
		Into   string `json:"into"`
		Reason string `json:"reason"`
	} `json:"merge"`
	Remove []struct {
		Tag    string `json:"tag"`
		Reason string `json:"reason"`
	} `json:"remove"`
	Reparent []struct {
		Tag string `json:"tag"`
		// Parent is the tag to put it under, or "" (or null) for the top
		// level.
		Parent *string `json:"parent"`
		Reason string  `json:"reason"`
	} `json:"reparent"`
}

// parsePruneTagAnswer reads the JSON object in text, the LLM's answer, which
// may be inside a code block or have words around it.
func parsePruneTagAnswer(text string) (pruneTagAnswer, *PublishError) {
	var answer pruneTagAnswer
	start, end := strings.Index(text, "{"), strings.LastIndex(text, "}")
	if start < 0 || end < start {
		return answer, publishErr(http.StatusBadRequest, "Paste the LLM's whole answer: the JSON object it wrote, from { to }.")
	}
	if err := json.Unmarshal([]byte(text[start:end+1]), &answer); err != nil {
		return answer, publishErr(http.StatusBadRequest, "The answer isn't the JSON the prompt asks for (%v). Ask the LLM to answer with only that JSON.", err)
	}
	if len(answer.Merge)+len(answer.Remove)+len(answer.Reparent) == 0 {
		return answer, publishErr(http.StatusBadRequest, "The answer doesn't suggest any changes, so the tags are fine as they are.")
	}
	return answer, nil
}

// PruneTagMerge is a merge the answer suggests: every photo with Tag gets
// Into instead.
type PruneTagMerge struct {
	Tag    string `json:"tag"`
	Into   string `json:"into"`
	Reason string `json:"reason"`
	// Photos is how many photo files list Tag.
	Photos int `json:"photos"`
	// Children are the tags directly under Tag, which go under Into.
	Children []string `json:"children"`
}

// PruneTagRemoval is a tag the answer suggests removing, from every photo
// too.
type PruneTagRemoval struct {
	Tag    string `json:"tag"`
	Reason string `json:"reason"`
	// Photos is how many photo files list it.
	Photos int `json:"photos"`
	// Children are the tags directly under it, which go under its parent.
	Children []string `json:"children"`
}

// PruneTagReparent is a new parent the answer suggests for Tag.
type PruneTagReparent struct {
	Tag string `json:"tag"`
	// From is its parent now, or "" at the top level.
	From string `json:"from"`
	// Parent is its new parent, or "" for the top level.
	Parent string `json:"parent"`
	Reason string `json:"reason"`
}

// PruneTagSkipped is a change in the answer that can't be made, with why.
type PruneTagSkipped struct {
	Change string `json:"change"`
	Reason string `json:"reason"`
}

// PruneTagsPreview is what pasting the LLM's answer would do to the tags,
// each change checked against the ones before it.
type PruneTagsPreview struct {
	// Tags is how many tags there are.
	Tags     int                `json:"tags"`
	Merge    []PruneTagMerge    `json:"merge"`
	Remove   []PruneTagRemoval  `json:"remove"`
	Reparent []PruneTagReparent `json:"reparent"`
	Skipped  []PruneTagSkipped  `json:"skipped"`
}

// tagLookup finds a tag by its ID or name, ignoring case, or by the ID made
// from what the answer wrote.
type tagLookup map[string]string

// newTagLookup is a tagLookup for tags.
func newTagLookup(tags map[string]Group) tagLookup {
	out := tagLookup{}
	for id, g := range tags {
		out[strings.ToLower(g.Name)], out[id] = id, id
	}
	return out
}

// id is the ID of the tag the answer means by name, or name cleaned up when
// it's no tag, so the review says so.
func (l tagLookup) id(name string) string {
	clean := cleanTagName(name)
	if id, ok := l[strings.ToLower(clean)]; ok {
		return id
	}
	if id, ok := l[tagID(clean)]; ok {
		return id
	}
	return clean
}

// parent is the ID of the parent the answer means, "" for the top level.
func (l tagLookup) parent(name *string) string {
	if name == nil {
		return ""
	}
	switch clean := cleanTagName(*name); strings.ToLower(clean) {
	case "", "none", "null":
		return ""
	default:
		return l.id(clean)
	}
}

// request is answer as a PruneTags of tag IDs, with each change's reason in
// the same order.
func (l tagLookup) request(answer pruneTagAnswer) (PruneTags, map[string][]string) {
	var req PruneTags
	reasons := map[string][]string{}
	for _, m := range answer.Merge {
		req.Merge = append(req.Merge, TagMerge{Tag: l.id(m.Tag), Into: l.id(m.Into)})
		reasons[pruneMerge] = append(reasons[pruneMerge], strings.TrimSpace(m.Reason))
	}
	for _, r := range answer.Remove {
		req.Remove = append(req.Remove, l.id(r.Tag))
		reasons[pruneRemove] = append(reasons[pruneRemove], strings.TrimSpace(r.Reason))
	}
	for _, r := range answer.Reparent {
		req.Reparent = append(req.Reparent, TagReparent{Tag: l.id(r.Tag), Parent: l.parent(r.Parent)})
		reasons[pruneReparent] = append(reasons[pruneReparent], strings.TrimSpace(r.Reason))
	}
	return req, reasons
}

// PreviewPruneTags reads answer, the LLM's JSON suggesting tags to merge,
// remove and put under others, and says what each change would do, and which
// can't be made and why. It only reads.
func (c *Client) PreviewPruneTags(ctx context.Context, gh settings.GitHub, answer string) (PruneTagsPreview, error) {
	parsed, perr := parsePruneTagAnswer(answer)
	if perr != nil {
		return PruneTagsPreview{}, perr
	}
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return PruneTagsPreview{}, perr
	}
	p := newTagPruner(scan.w.groups()[Tags.Folder])
	req, reasons := newTagLookup(p.tags).request(parsed)
	preview := PruneTagsPreview{
		Tags: len(p.tags), Merge: []PruneTagMerge{}, Remove: []PruneTagRemoval{},
		Reparent: []PruneTagReparent{}, Skipped: []PruneTagSkipped{},
	}
	counts := tagCounts(scan)
	for _, s := range p.steps(req) {
		before := p.parentOf(stepTag(req, s))
		if why := s.run(); why != "" {
			preview.Skipped = append(preview.Skipped, PruneTagSkipped{Change: s.said, Reason: why})
			continue
		}
		preview.add(p, req, s, reasons[s.kind][s.index], counts, before)
	}
	return preview, nil
}

// stepTag is the tag s changes.
func stepTag(req PruneTags, s pruneStep) string {
	switch s.kind {
	case pruneMerge:
		return req.Merge[s.index].Tag
	case pruneRemove:
		return req.Remove[s.index]
	default:
		return req.Reparent[s.index].Tag
	}
}

// add lists s, a change that can be made, with the answer's reason for it.
// from is the tag's parent before it.
func (pv *PruneTagsPreview) add(p *tagPruner, req PruneTags, s pruneStep, reason string, counts map[string]int, from string) {
	switch s.kind {
	case pruneMerge:
		m := req.Merge[s.index]
		pv.Merge = append(pv.Merge, PruneTagMerge{Tag: m.Tag, Into: m.Into, Reason: reason, Photos: counts[m.Tag], Children: p.children(m.Tag)})
	case pruneRemove:
		id := req.Remove[s.index]
		pv.Remove = append(pv.Remove, PruneTagRemoval{Tag: id, Reason: reason, Photos: counts[id], Children: p.children(id)})
	default:
		r := req.Reparent[s.index]
		pv.Reparent = append(pv.Reparent, PruneTagReparent{Tag: r.Tag, From: from, Parent: r.Parent, Reason: reason})
	}
}

// children is the tags whose own parent is id, sorted.
func (p *tagPruner) children(id string) []string {
	out := []string{}
	for _, g := range p.tags {
		if g.Parent == id {
			out = append(out, g.ID)
		}
	}
	slices.Sort(out)
	return out
}

// tagCounts is how many readable photo files list each tag, by ID.
func tagCounts(scan baseURLScan) map[string]int {
	out := map[string]int{}
	for _, f := range scan.files {
		if f.err == "" {
			for _, id := range readBulkPhoto(f).tags {
				out[id]++
			}
		}
	}
	return out
}
