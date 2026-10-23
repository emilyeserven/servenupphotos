package github

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// MetaFields are the photo JSON fields a metadata group can group values of,
// as the photo files name them.
var MetaFields = []string{"camera", "lens", "focalLength", "aperture", "exposure", "iso"}

// rangeMetaFields are the fields whose values read as numbers (an exposure
// such as "1/250" as seconds), so their groups can be a range.
var rangeMetaFields = []string{"focalLength", "aperture", "exposure", "iso"}

// maxMetaValues is how many values one metadata group can have.
const maxMetaValues = 500

// MetaGroup is a metadata group file: a named set of values of one photo
// field, such as "Wide angle" for focal lengths 10 to 24, or every EXIF
// spelling of one lens.
type MetaGroup struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	// Field is the photo field the values are of, one of MetaFields.
	Field string `json:"field"`
	// Parent is the ID of the group of the same field this one is in, such
	// as a "Canon" lens group for "Canon kit lenses"; "" for none.
	Parent string `json:"parent"`
	// Order is where the group goes among the groups in the same parent (or
	// at the top level): lowest first, groups with the same order by name.
	// Files from before it was added have none, which reads as 0.
	Order int `json:"order"`
	// Values are the field's values in the group, each a string or a number
	// as the photo files have it, such as 11 for a focal length or
	// "Canon EOS 80D" for a camera.
	Values []json.RawMessage `json:"values"`
	// Range, for a focal length, aperture, exposure or ISO group, is every
	// value from Min to Max, both included, whether or not a photo has it
	// yet, or with only one of them, every value from Min up or up to Max;
	// nil for a group of only its Values.
	Range *MetaRange `json:"range,omitempty"`
}

// MetaRange is a range of numbers: focal lengths in mm, apertures as
// f-numbers, ISO, or exposures in seconds (1/250 is 0.004). Either end can be
// left out (nil) for a range open at that end, such as ISO 12800 and up, but
// not both.
type MetaRange struct {
	Min *float64 `json:"min,omitempty"`
	Max *float64 `json:"max,omitempty"`
}

// SaveMetaGroup saves group as <folder>/metainfo/<id>.json, new or replacing
// the one there, in the pending changes. It fails when another group of the
// same field has the same name, ignoring case, or its parent isn't another
// group of its field, or is in it.
func (c *Client) SaveMetaGroup(ctx context.Context, gh settings.GitHub, group MetaGroup) (EntryResult, error) {
	group, perr := validMetaGroup(group)
	if perr != nil {
		return EntryResult{}, perr
	}
	return c.saveEntry(ctx, gh, MetaInfo, group.ID, group, func(others []Entry) *PublishError {
		if perr := metaGroupNameTaken(others, group); perr != nil {
			return perr
		}
		return badMetaParent(others, group)
	})
}

// DeleteMetaGroup removes the metadata group file named id in the pending
// changes. It fails when there's no such group, or other groups are in it.
func (c *Client) DeleteMetaGroup(ctx context.Context, gh settings.GitHub, id string) (EntryResult, error) {
	return c.deleteEntry(ctx, gh, MetaInfo, id, func(others []Entry) *PublishError {
		if child := metaChildOf(others, id); child != "" {
			return publishErr(http.StatusConflict, "%q is in this group. Move it out or remove it first.", child)
		}
		return nil
	})
}

// deleteEntry removes kind's file named id in the pending changes, after
// check passes on the kind's other files. It fails when there's no such file.
func (c *Client) deleteEntry(ctx context.Context, gh settings.GitHub, kind EntryKind, id string, check func(others []Entry) *PublishError) (EntryResult, error) {
	if perr := validEntryID(kind.Name, id); perr != nil {
		return EntryResult{}, perr
	}
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return EntryResult{}, perr
	}
	file := w.root + "/" + kind.Folder + "/" + id + ".json"
	before, others := splitEntry(w.entries(kind), file)
	if before == nil {
		return EntryResult{}, publishErr(http.StatusNotFound, "There's no %s with the ID %q.", kind.Name, id)
	}
	if perr := check(others); perr != nil {
		return EntryResult{}, perr
	}
	result := EntryResult{Path: file, Data: json.RawMessage("null"), Before: before}
	if result.pendingSave, perr = c.saveFiles(w, []ScanChange{{Path: file, Before: before}}); perr != nil {
		return EntryResult{}, perr
	}
	result.Changed = true
	return result, nil
}

// metaGroupNameTaken fails when another group in others is of group's field
// and has its name, ignoring case and surrounding spaces.
func metaGroupNameTaken(others []Entry, group MetaGroup) *PublishError {
	for _, e := range others {
		var other MetaGroup
		if json.Unmarshal(e.Data, &other) != nil || other.Field != group.Field {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(other.Name), group.Name) {
			return publishErr(http.StatusConflict, "There's already a %s group named %q (%s). Pick another name.", group.Field, other.Name, e.Path)
		}
	}
	return nil
}

// metaParents is each group's parent in others of field, by ID.
func metaParents(others []Entry, field string) map[string]string {
	parents := map[string]string{}
	for _, e := range others {
		var other MetaGroup
		if json.Unmarshal(e.Data, &other) == nil && other.Field == field {
			parents[other.ID] = other.Parent
		}
	}
	return parents
}

// badMetaParent fails when group's parent isn't another group of its field
// in others, or when group is already above its parent, which would make a
// loop.
func badMetaParent(others []Entry, group MetaGroup) *PublishError {
	if group.Parent == "" {
		return nil
	}
	parents := metaParents(others, group.Field)
	if _, ok := parents[group.Parent]; !ok {
		return publishErr(http.StatusBadRequest, "There's no %s group with the ID %q to put this one in.", group.Field, group.Parent)
	}
	// Walks up from the parent; reaching group means group is above its own parent.
	for id, seen := group.Parent, 0; id != "" && seen <= len(parents); id, seen = parents[id], seen+1 {
		if id == group.ID {
			return publishErr(http.StatusBadRequest, "A group can't be in itself or in a group that's in it.")
		}
	}
	return nil
}

// metaChildOf is the name of a group in others whose parent is id, or "".
func metaChildOf(others []Entry, id string) string {
	for _, e := range others {
		var other MetaGroup
		if json.Unmarshal(e.Data, &other) == nil && other.Parent == id {
			return other.Name
		}
	}
	return ""
}

// validMetaGroup checks group and returns it trimmed, with its values
// compacted and each kept once, as it will be saved.
func validMetaGroup(group MetaGroup) (MetaGroup, *PublishError) {
	g := MetaGroup{
		ID: strings.TrimSpace(group.ID), Name: strings.TrimSpace(group.Name),
		Description: strings.TrimSpace(group.Description), Field: strings.TrimSpace(group.Field),
		Parent: strings.TrimSpace(group.Parent), Order: group.Order, Range: group.Range,
	}
	if perr := validEntryID(MetaInfo.Name, g.ID); perr != nil {
		return g, perr
	}
	if !slices.Contains(MetaFields, g.Field) {
		return g, publishErr(http.StatusBadRequest, "A metadata group's field is one of %s.", strings.Join(MetaFields, ", "))
	}
	if perr := validMetaText(g); perr != nil {
		return g, perr
	}
	if perr := validMetaShape(g); perr != nil {
		return g, perr
	}
	values, perr := metaValues(group.Values)
	g.Values = values
	return g, perr
}

// validMetaShape fails when g's parent isn't an ID, or it has a range that
// its field can't have or that ends before it starts.
func validMetaShape(g MetaGroup) *PublishError {
	if g.Parent != "" {
		if perr := validEntryID("parent group", g.Parent); perr != nil {
			return perr
		}
	}
	if g.Order < 0 {
		return publishErr(http.StatusBadRequest, "A group's order is 0 or more.")
	}
	if g.Range == nil {
		return nil
	}
	if !slices.Contains(rangeMetaFields, g.Field) {
		return publishErr(http.StatusBadRequest, "Only focal length, aperture, exposure and ISO groups can be a range.")
	}
	return validRange(*g.Range)
}

// validRange fails when r has neither end, or its lowest value is above its
// highest.
func validRange(r MetaRange) *PublishError {
	if r.Min == nil && r.Max == nil {
		return publishErr(http.StatusBadRequest, "Give the range a lowest value, a highest value, or both.")
	}
	if r.Min != nil && r.Max != nil && *r.Min > *r.Max {
		return publishErr(http.StatusBadRequest, "The range's lowest value is above its highest.")
	}
	return nil
}

// validMetaText fails when g has no name, or its name or description is too
// long.
func validMetaText(g MetaGroup) *PublishError {
	if g.Name == "" {
		return publishErr(http.StatusBadRequest, "Give the group a name.")
	}
	if utf8.RuneCountInString(g.Name) > maxGroupNameLength {
		return publishErr(http.StatusBadRequest, "Keep the name to %d characters.", maxGroupNameLength)
	}
	if utf8.RuneCountInString(g.Description) > maxGroupDescriptionLength {
		return publishErr(http.StatusBadRequest, "Keep the description to %d characters.", maxGroupDescriptionLength)
	}
	return nil
}

// metaValues is values compacted, each kept once in the order given. It
// fails unless each is a string or a number.
func metaValues(values []json.RawMessage) ([]json.RawMessage, *PublishError) {
	if len(values) > maxMetaValues {
		return nil, publishErr(http.StatusBadRequest, "Keep a group to %d values.", maxMetaValues)
	}
	out := make([]json.RawMessage, 0, len(values))
	seen := map[string]bool{}
	for _, v := range values {
		var compact bytes.Buffer
		if json.Compact(&compact, v) != nil || !isMetaValue(compact.Bytes()) {
			return nil, publishErr(http.StatusBadRequest, "Each value is a string or a number, as the photos have it.")
		}
		if key := compact.String(); !seen[key] {
			seen[key] = true
			out = append(out, compact.Bytes())
		}
	}
	return out, nil
}

// isMetaValue reports a JSON string or number.
func isMetaValue(v []byte) bool {
	var s any
	if json.Unmarshal(v, &s) != nil {
		return false
	}
	switch s.(type) {
	case string, float64:
		return true
	}
	return false
}
