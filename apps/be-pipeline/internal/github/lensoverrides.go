package github

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// LensOverride is a lens override file: what to write instead of the EXIF
// values of photos taken with one lens, whatever the camera, such as
// "Fujinon XF 23mm F1.4 R" for the lens "XF23mmF1.4 R".
type LensOverride struct {
	ID string `json:"id"`
	// Lens is the lens as its photos' EXIF names it, such as "XF23mmF1.4 R".
	Lens string `json:"lens"`
	// Rules are applied in order, so a later rule's value for a field wins.
	// The rules of the photo's camera's override come after them.
	Rules []OverrideRule `json:"rules"`
}

// SaveLensOverride saves override as <folder>/lensoverrides/<id>.json, new
// or replacing the one there, in the pending changes. It fails when another
// override is for the same lens.
func (c *Client) SaveLensOverride(ctx context.Context, gh settings.GitHub, override LensOverride) (EntryResult, error) {
	override, perr := validLensOverride(override)
	if perr != nil {
		return EntryResult{}, perr
	}
	return c.saveEntry(ctx, gh, LensOverrides, override.ID, override, func(others []Entry) *PublishError {
		for _, o := range parseLensOverrides(others) {
			if o.Lens == override.Lens {
				return publishErr(http.StatusConflict, "There's already an override for the lens %q (%s). Edit that one.", o.Lens, o.ID)
			}
		}
		return nil
	})
}

// DeleteLensOverride removes the lens override file named id in the pending
// changes. It fails when there's no such override.
func (c *Client) DeleteLensOverride(ctx context.Context, gh settings.GitHub, id string) (EntryResult, error) {
	return c.deleteEntry(ctx, gh, LensOverrides, id, func([]Entry) *PublishError { return nil })
}

// parseLensOverrides is the lens overrides in entries that can be read.
func parseLensOverrides(entries []Entry) []LensOverride {
	var out []LensOverride
	for _, e := range entries {
		var o LensOverride
		if json.Unmarshal(e.Data, &o) == nil && o.Lens != "" {
			out = append(out, o)
		}
	}
	return out
}

// lensOverrideFor is the override in overrides for lens, a JSON value, or
// nil when there's none.
func lensOverrideFor(overrides []LensOverride, lens json.RawMessage) *LensOverride {
	var name string
	if json.Unmarshal(lens, &name) != nil || name == "" {
		return nil
	}
	for i := range overrides {
		if overrides[i].Lens == name {
			return &overrides[i]
		}
	}
	return nil
}

// validLensOverride checks o and returns it trimmed, with its values
// compacted, as it will be saved.
func validLensOverride(o LensOverride) (LensOverride, *PublishError) {
	out := LensOverride{ID: strings.TrimSpace(o.ID), Lens: strings.TrimSpace(o.Lens), Rules: []OverrideRule{}}
	if perr := validEntryID(LensOverrides.Name, out.ID); perr != nil {
		return out, perr
	}
	if out.Lens == "" {
		return out, publishErr(http.StatusBadRequest, "Say which lens the override is for, as its EXIF names it.")
	}
	if utf8.RuneCountInString(out.Lens) > maxEntryTextLength {
		return out, publishErr(http.StatusBadRequest, "Keep the lens to %d characters.", maxEntryTextLength)
	}
	rules, perr := validOverrideRules(o.Rules)
	out.Rules = rules
	return out, perr
}
