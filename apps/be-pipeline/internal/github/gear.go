package github

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"unicode/utf8"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// The two kinds of gear a gear file can be for.
const (
	gearCamera = "camera"
	gearLens   = "lens"
)

// Gear is a gear file: a picture and a few words for one camera or lens,
// which the portfolio's Gear & settings filter shows in place of its drawing
// of that kind of camera or lens.
type Gear struct {
	ID string `json:"id"`
	// Kind is "camera" or "lens".
	Kind string `json:"kind"`
	// Name is the camera or lens exactly as the photo files name it, such as
	// "Fujifilm X-T5", after the camera overrides and custom lenses.
	Name string `json:"name"`
	// Image is the picture's public URL in R2, or "" for none.
	Image string `json:"image"`
	// Description is a few words about it, shown under the picture, or "".
	Description string `json:"description"`
}

// SaveGear saves gear as <folder>/gear/<id>.json, new or replacing the one
// there, in the pending changes. It fails when another gear file is for the
// same camera or lens, ignoring case.
func (c *Client) SaveGear(ctx context.Context, gh settings.GitHub, gear Gear) (EntryResult, error) {
	gear, perr := validGear(gear)
	if perr != nil {
		return EntryResult{}, perr
	}
	return c.saveEntry(ctx, gh, GearKind, gear.ID, gear, func(others []Entry) *PublishError {
		for _, o := range parseGear(others) {
			if o.Kind == gear.Kind && strings.EqualFold(o.Name, gear.Name) {
				return publishErr(http.StatusConflict, "%q already has a picture saved (%s).", o.Name, o.ID)
			}
		}
		return nil
	})
}

// DeleteGear removes the gear file named id in the pending changes, so the
// portfolio goes back to drawing that camera or lens.
func (c *Client) DeleteGear(ctx context.Context, gh settings.GitHub, id string) (EntryResult, error) {
	return c.deleteEntry(ctx, gh, GearKind, id, func([]Entry) *PublishError { return nil })
}

// parseGear is the gear files in entries that can be read.
func parseGear(entries []Entry) []Gear {
	var out []Gear
	for _, e := range entries {
		var g Gear
		if json.Unmarshal(e.Data, &g) == nil && g.ID != "" {
			out = append(out, g)
		}
	}
	return out
}

// validGear checks g and returns it trimmed, as it will be saved.
func validGear(g Gear) (Gear, *PublishError) {
	out := Gear{
		ID: strings.TrimSpace(g.ID), Kind: g.Kind, Name: strings.TrimSpace(g.Name),
		Image: strings.TrimSpace(g.Image), Description: strings.TrimSpace(g.Description),
	}
	if perr := validEntryID(GearKind.Name, out.ID); perr != nil {
		return out, perr
	}
	if out.Kind != gearCamera && out.Kind != gearLens {
		return out, publishErr(http.StatusBadRequest, "Gear is a camera or a lens.")
	}
	if out.Name == "" || utf8.RuneCountInString(out.Name) > maxEntryTextLength {
		return out, publishErr(http.StatusBadRequest, "Name the %s, in up to %d characters.", out.Kind, maxEntryTextLength)
	}
	if utf8.RuneCountInString(out.Description) > maxGroupDescriptionLength {
		return out, publishErr(http.StatusBadRequest, "Keep the description to %d characters.", maxGroupDescriptionLength)
	}
	return out, validGearImage(out)
}

// validGearImage checks that g has a picture or a description, and that its
// picture is a web link.
func validGearImage(g Gear) *PublishError {
	if g.Image == "" && g.Description == "" {
		return publishErr(http.StatusBadRequest, "Add a picture or a description.")
	}
	if g.Image == "" {
		return nil
	}
	u, err := url.Parse(g.Image)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" {
		return publishErr(http.StatusBadRequest, "The picture's link should start with https://.")
	}
	return nil
}
