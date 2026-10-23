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
	// Values are the field's values in the group, each a string or a number
	// as the photo files have it, such as 11 for a focal length or
	// "Canon EOS 80D" for a camera.
	Values []json.RawMessage `json:"values"`
}

// SaveMetaGroup saves group as <folder>/metainfo/<id>.json, new or replacing
// the one there, in the pending changes. It fails when another group of the
// same field has the same name, ignoring case.
func (c *Client) SaveMetaGroup(ctx context.Context, gh settings.GitHub, group MetaGroup) (EntryResult, error) {
	group, perr := validMetaGroup(group)
	if perr != nil {
		return EntryResult{}, perr
	}
	return c.saveEntry(ctx, gh, MetaInfo, group.ID, group, func(others []Entry) *PublishError {
		return metaGroupNameTaken(others, group)
	})
}

// DeleteMetaGroup removes the metadata group file named id in the pending
// changes. It fails when there's no such group.
func (c *Client) DeleteMetaGroup(ctx context.Context, gh settings.GitHub, id string) (EntryResult, error) {
	if perr := validEntryID(MetaInfo.Name, id); perr != nil {
		return EntryResult{}, perr
	}
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return EntryResult{}, perr
	}
	file := w.root + "/" + MetaInfo.Folder + "/" + id + ".json"
	before, _ := splitEntry(w.entries(MetaInfo), file)
	if before == nil {
		return EntryResult{}, publishErr(http.StatusNotFound, "There's no metadata group with the ID %q.", id)
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

// validMetaGroup checks group and returns it trimmed, with its values
// compacted and each kept once, as it will be saved.
func validMetaGroup(group MetaGroup) (MetaGroup, *PublishError) {
	g := MetaGroup{
		ID: strings.TrimSpace(group.ID), Name: strings.TrimSpace(group.Name),
		Description: strings.TrimSpace(group.Description), Field: strings.TrimSpace(group.Field),
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
	values, perr := metaValues(group.Values)
	g.Values = values
	return g, perr
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
