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
	// Image is the public URL in R2 of the picture's crop, the version the
	// portfolio shows, or "" for none.
	Image string `json:"image"`
	// Original is the public URL in R2 of the picture as uploaded, which Image
	// was cropped from, or "" when there's none.
	Original string `json:"original,omitempty"`
	// Crop is the part of Original that Image shows, or nil when there's no
	// Original.
	Crop *GearCrop `json:"crop,omitempty"`
	// Subject is the box around the camera or lens in Original, found when it
	// was uploaded, as fractions of its width and height, which crops are
	// fitted to; nil when there's no Original or it was uploaded before boxes.
	Subject *GearBox `json:"subject,omitempty"`
	// Description is a few words about it, shown under the picture, or "".
	Description string `json:"description"`
}

// GearCrop is the part of a gear picture's original that its crop shows, as
// fractions of the original's width and height. It may reach past the
// original's edges.
type GearCrop struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
	// Fill is what fills the crop around the picture: "white", or "" for
	// transparent.
	Fill string `json:"fill,omitempty"`
}

// GearBox is a box in a gear picture, as fractions of its width and height.
type GearBox struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
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
		Original: strings.TrimSpace(g.Original), Crop: g.Crop, Subject: g.Subject,
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
	if perr := validGearImage(out); perr != nil {
		return out, perr
	}
	return out, validGearOriginal(out)
}

// validGearOriginal checks that g's original, if it has one, is a web link
// with a crop.
func validGearOriginal(g Gear) *PublishError {
	if g.Original == "" && g.Crop == nil {
		return nil
	}
	if !webLink(g.Original) || !validCrop(g.Crop) {
		return publishErr(http.StatusBadRequest, "An original picture needs a web link and a crop.")
	}
	return nil
}

// validCrop reports whether c is there, has a size and a fill it knows.
func validCrop(c *GearCrop) bool {
	return c != nil && c.Width > 0 && c.Height > 0 && (c.Fill == "" || c.Fill == "white")
}

// webLink reports whether raw is an http or https link.
func webLink(raw string) bool {
	u, err := url.Parse(raw)
	return err == nil && (u.Scheme == "https" || u.Scheme == "http") && u.Host != ""
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
	if !webLink(g.Image) {
		return publishErr(http.StatusBadRequest, "The picture's link should start with https://.")
	}
	return nil
}
