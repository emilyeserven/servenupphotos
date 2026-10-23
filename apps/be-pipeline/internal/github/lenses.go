package github

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// customLensField is the photo JSON field that holds the ID of the custom
// lens picked for the photo.
const customLensField = "customLens"

// CustomLens is a custom lens file: a lens EXIF doesn't name, such as a
// manual lens, which a photo can be given on the Photo page.
type CustomLens struct {
	ID string `json:"id"`
	// Name is what a photo given the lens has as its lens.
	Name        string `json:"name"`
	Description string `json:"description"`
	// FocalLength, in mm, is written over a photo's focal length; nil keeps
	// the photo's own.
	FocalLength *float64 `json:"focalLength"`
	// Aperture, an f-number, is written over a photo's aperture; nil keeps
	// the photo's own, unless ManualAperture is set.
	Aperture *float64 `json:"aperture"`
	// ManualAperture marks the photos given the lens as taken at an aperture
	// no one recorded, as manual lenses usually are: their aperture becomes
	// null and their manualAperture true.
	ManualAperture bool `json:"manualAperture"`
}

// SaveCustomLens saves lens as <folder>/lenses/<id>.json, new or replacing
// the one there, in the pending changes. It fails when another custom lens
// has the same name, ignoring case.
func (c *Client) SaveCustomLens(ctx context.Context, gh settings.GitHub, lens CustomLens) (EntryResult, error) {
	lens, perr := validCustomLens(lens)
	if perr != nil {
		return EntryResult{}, perr
	}
	return c.saveEntry(ctx, gh, Lenses, lens.ID, lens, func(others []Entry) *PublishError {
		for _, o := range parseLenses(others) {
			if strings.EqualFold(o.Name, lens.Name) {
				return publishErr(http.StatusConflict, "There's already a custom lens named %q (%s). Pick another name.", o.Name, o.ID)
			}
		}
		return nil
	})
}

// DeleteCustomLens removes the custom lens file named id in the pending
// changes. Photos given it keep what it wrote until the camera overrides
// are applied again, which puts their EXIF values back.
func (c *Client) DeleteCustomLens(ctx context.Context, gh settings.GitHub, id string) (EntryResult, error) {
	return c.deleteEntry(ctx, gh, Lenses, id, func([]Entry) *PublishError { return nil })
}

// parseLenses is the custom lenses in entries that can be read.
func parseLenses(entries []Entry) []CustomLens {
	var out []CustomLens
	for _, e := range entries {
		var l CustomLens
		if json.Unmarshal(e.Data, &l) == nil && l.ID != "" {
			out = append(out, l)
		}
	}
	return out
}

// lensFields are the fields the custom lens with the ID id, a JSON value,
// writes over a photo: its name as the lens, and its focal length and
// aperture when it has them. None when id is null or no lens has it.
func lensFields(lenses []CustomLens, id json.RawMessage) map[string]json.RawMessage {
	var want string
	if json.Unmarshal(id, &want) != nil || want == "" {
		return nil
	}
	for _, l := range lenses {
		if l.ID == want {
			return l.fields()
		}
	}
	return nil
}

// fields are the photo fields l writes.
func (l CustomLens) fields() map[string]json.RawMessage {
	out := map[string]json.RawMessage{}
	out["lens"], _ = json.Marshal(l.Name)
	if l.FocalLength != nil {
		out["focalLength"], _ = json.Marshal(*l.FocalLength)
	}
	switch {
	case l.ManualAperture:
		out["aperture"], out["manualAperture"] = json.RawMessage("null"), json.RawMessage("true")
	case l.Aperture != nil:
		out["aperture"], _ = json.Marshal(*l.Aperture)
		out["manualAperture"] = json.RawMessage("false")
	}
	return out
}

// validCustomLens checks l and returns it trimmed, as it will be saved.
func validCustomLens(l CustomLens) (CustomLens, *PublishError) {
	out := CustomLens{
		ID: strings.TrimSpace(l.ID), Name: strings.TrimSpace(l.Name), Description: strings.TrimSpace(l.Description),
		FocalLength: l.FocalLength, Aperture: l.Aperture, ManualAperture: l.ManualAperture,
	}
	if out.ManualAperture {
		out.Aperture = nil
	}
	if perr := validEntryID(Lenses.Name, out.ID); perr != nil {
		return out, perr
	}
	if out.Name == "" {
		return out, publishErr(http.StatusBadRequest, "Give the lens a name.")
	}
	if utf8.RuneCountInString(out.Name) > maxEntryTextLength || utf8.RuneCountInString(out.Description) > maxGroupDescriptionLength {
		return out, publishErr(http.StatusBadRequest, "Keep the name to %d characters and the description to %d.", maxEntryTextLength, maxGroupDescriptionLength)
	}
	if notPositive(out.FocalLength) || notPositive(out.Aperture) {
		return out, publishErr(http.StatusBadRequest, "The focal length and aperture are numbers above 0, or empty.")
	}
	return out, nil
}

// notPositive reports a number that's 0 or less.
func notPositive(n *float64) bool {
	return n != nil && *n <= 0
}
