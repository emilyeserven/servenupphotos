package github

import (
	"fmt"
	"slices"
	"strings"
)

// TagMerge folds one tag into another: every photo with Tag gets Into
// instead, and Tag's file is deleted.
type TagMerge struct {
	Tag  string `json:"tag"`
	Into string `json:"into"`
}

// TagReparent puts Tag under Parent, or at the top level when Parent is "".
type TagReparent struct {
	Tag    string `json:"tag"`
	Parent string `json:"parent"`
}

// PruneTags is what Tag pruning saves, as the review left it: the tags to
// merge into others, the tags to remove, and the tags to put under another.
type PruneTags struct {
	Merge    []TagMerge    `json:"merge"`
	Remove   []string      `json:"remove"`
	Reparent []TagReparent `json:"reparent"`
}

// size is how many changes p asks for.
func (p PruneTags) size() int {
	return len(p.Merge) + len(p.Remove) + len(p.Reparent)
}

// tagPruner works out what pruning does to the tags, one change at a time,
// so each change is checked against the ones before it.
type tagPruner struct {
	// tags is every readable tag, by ID.
	tags map[string]Group
	// gone is the tags pruned away, by ID: "" for a removed tag, or the tag
	// a merged one went into.
	gone map[string]string
	// parents is the new parents the changes set, by tag ID; "" is the top
	// level.
	parents map[string]string
}

// newTagPruner is a tagPruner for tags, leaving out the ones that couldn't
// be read.
func newTagPruner(tags []Group) *tagPruner {
	p := &tagPruner{tags: map[string]Group{}, gone: map[string]string{}, parents: map[string]string{}}
	for _, g := range tags {
		if g.Error == "" {
			p.tags[g.ID] = g
		}
	}
	return p
}

// kept says why id can't be changed: it isn't a tag, or was already pruned
// away; "" when it can.
func (p *tagPruner) kept(id string) string {
	if _, ok := p.tags[id]; !ok {
		return fmt.Sprintf("%q isn't a tag", id)
	}
	if into, ok := p.gone[id]; ok {
		return p.goneReason(id, into)
	}
	return ""
}

// goneReason says how id, a pruned tag, went: removed or merged into into.
func (p *tagPruner) goneReason(id, into string) string {
	if into == "" {
		return fmt.Sprintf("%q is removed already", id)
	}
	return fmt.Sprintf("%q is merged into %q already", id, into)
}

// mergedInto is a tag merged into id, or "" when none is.
func (p *tagPruner) mergedInto(id string) string {
	for from, into := range p.gone {
		if into == id {
			return from
		}
	}
	return ""
}

// merge folds m.Tag into m.Into, or says why it can't.
func (p *tagPruner) merge(m TagMerge) string {
	if m.Tag == m.Into {
		return "a tag can't be merged into itself"
	}
	if why := p.firstReason(p.kept(m.Tag), p.kept(m.Into)); why != "" {
		return why
	}
	p.gone[m.Tag] = m.Into
	return p.undoIfLooped(m.Into, func() { delete(p.gone, m.Tag) })
}

// remove removes id, or says why it can't.
func (p *tagPruner) remove(id string) string {
	if why := p.kept(id); why != "" {
		return why
	}
	if from := p.mergedInto(id); from != "" {
		return fmt.Sprintf("%q is merged into it", from)
	}
	p.gone[id] = ""
	return ""
}

// reparent puts r.Tag under r.Parent, or says why it can't.
func (p *tagPruner) reparent(r TagReparent) string {
	if why := p.kept(r.Tag); why != "" {
		return why
	}
	if why := p.parentReason(r); why != "" {
		return why
	}
	before, had := p.parents[r.Tag]
	p.parents[r.Tag] = r.Parent
	return p.undoIfLooped(r.Tag, func() {
		if had {
			p.parents[r.Tag] = before
		} else {
			delete(p.parents, r.Tag)
		}
	})
}

// parentReason says why r's parent can't be r.Tag's: it's the tag itself,
// isn't a tag, or is already its parent; "" when it can be.
func (p *tagPruner) parentReason(r TagReparent) string {
	if r.Parent == r.Tag {
		return "a tag can't be its own parent"
	}
	if r.Parent != "" {
		if why := p.kept(r.Parent); why != "" {
			return why
		}
	}
	if p.parentOf(r.Tag) == r.Parent {
		return "it's there already"
	}
	return ""
}

// firstReason is the first of reasons that isn't "".
func (p *tagPruner) firstReason(reasons ...string) string {
	for _, r := range reasons {
		if r != "" {
			return r
		}
	}
	return ""
}

// undoIfLooped runs undo and says why when the change just made puts a tag
// inside itself, naming id when it's that tag.
func (p *tagPruner) undoIfLooped(id string, undo func()) string {
	looped := p.looped(id)
	if looped == "" {
		return ""
	}
	undo()
	return fmt.Sprintf("it would put %q inside itself", looped)
}

// looped is a tag that ends up inside itself, first id and then the rest by
// ID, or "" when none does.
func (p *tagPruner) looped(id string) string {
	for _, t := range append([]string{id}, p.sortedIDs()...) {
		if !p.isGone(t) && p.inside(t, t) {
			return t
		}
	}
	return ""
}

// inside is whether ancestor is above id, following the parents after
// pruning.
func (p *tagPruner) inside(id, ancestor string) bool {
	at := id
	for range len(p.tags) {
		at = p.parentOf(at)
		if at == "" {
			return false
		}
		if at == ancestor {
			return true
		}
	}
	// It went round more times than there are tags: some loop is above it.
	return true
}

// parentOf is id's parent after pruning: the one a change set, or else its
// own, with a removed parent replaced by that tag's parent and a merged one
// by the tag it went into.
func (p *tagPruner) parentOf(id string) string {
	parent, set := p.parents[id]
	if !set {
		parent = p.tags[id].Parent
	}
	for range len(p.tags) {
		into, gone := p.gone[parent]
		if !gone {
			return parent
		}
		if into != "" {
			parent = into
			continue
		}
		parent = p.ownParent(parent)
	}
	return parent
}

// ownParent is id's parent before following what was pruned: the one a
// change set, or else its own.
func (p *tagPruner) ownParent(id string) string {
	if parent, set := p.parents[id]; set {
		return parent
	}
	return p.tags[id].Parent
}

// photoTag is what id becomes on a photo after pruning: itself, the tag it
// was merged into, or "" when it's removed.
func (p *tagPruner) photoTag(id string) string {
	for range len(p.tags) + 1 {
		into, gone := p.gone[id]
		if !gone {
			return id
		}
		id = into
		if id == "" {
			return ""
		}
	}
	return id
}

// prunedTags is tags after pruning, in order, each once.
func (p *tagPruner) prunedTags(tags []string) []string {
	out := make([]string, 0, len(tags))
	for _, id := range tags {
		if t := p.photoTag(id); t != "" && !slices.Contains(out, t) {
			out = append(out, t)
		}
	}
	return out
}

// pruneStep is one change pruning makes, said the way the review lists it,
// and run on the tagPruner. kind and index say which of the request's lists
// it's from, and where.
type pruneStep struct {
	kind  string
	index int
	said  string
	run   func() string
}

// The lists of a PruneTags, as pruneStep.kind names them.
const (
	pruneMerge    = "merge"
	pruneRemove   = "remove"
	pruneReparent = "reparent"
)

// steps is req's changes in the order they're checked: merges first, so a
// tag the answer both merges and removes keeps its photos, then removals,
// then new parents.
func (p *tagPruner) steps(req PruneTags) []pruneStep {
	var out []pruneStep
	for i, m := range req.Merge {
		out = append(out, pruneStep{pruneMerge, i, fmt.Sprintf("merge %s into %s", m.Tag, m.Into), func() string { return p.merge(m) }})
	}
	for i, id := range req.Remove {
		out = append(out, pruneStep{pruneRemove, i, "remove " + id, func() string { return p.remove(id) }})
	}
	for i, r := range req.Reparent {
		out = append(out, pruneStep{pruneReparent, i, reparentSaid(r), func() string { return p.reparent(r) }})
	}
	return out
}

// reparentSaid is r as the review says it.
func reparentSaid(r TagReparent) string {
	if r.Parent == "" {
		return "move " + r.Tag + " to the top level"
	}
	return "put " + r.Tag + " under " + r.Parent
}

// cleanPrune is req with every ID trimmed.
func cleanPrune(req PruneTags) PruneTags {
	out := PruneTags{}
	for _, m := range req.Merge {
		out.Merge = append(out.Merge, TagMerge{Tag: strings.TrimSpace(m.Tag), Into: strings.TrimSpace(m.Into)})
	}
	for _, id := range req.Remove {
		out.Remove = append(out.Remove, strings.TrimSpace(id))
	}
	for _, r := range req.Reparent {
		out.Reparent = append(out.Reparent, TagReparent{Tag: strings.TrimSpace(r.Tag), Parent: strings.TrimSpace(r.Parent)})
	}
	return out
}
