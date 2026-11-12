package github

import (
	"context"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// BioID is the ID of the one bio file, bio/bio.json.
const BioID = "bio"

// The most characters of the bio's text and of a self-portrait's alt text,
// the most photos it can have, and the longest link or photo path it keeps.
const (
	maxBioText      = 20000
	maxBioAlt       = 1000
	maxBioPhotos    = 200
	maxBioLinkChars = 500
)

// Bio is the bio file: the bio the portfolio will show about the
// photographer, written in Markdown, with its photos in order.
type Bio struct {
	// ID is always BioID: there's one bio.
	ID string `json:"id"`
	// Text is the bio itself, in Markdown.
	Text string `json:"text"`
	// Photos are the bio's photos, in the order the page shows them: the
	// portfolio's own photos and self-portraits, mixed.
	Photos []BioPhoto `json:"photos"`
}

// BioPhoto is one photo on the bio: either one of the portfolio's photos,
// by its file's path, or a self-portrait that's only on the bio.
type BioPhoto struct {
	// Photo is the path of the portfolio photo's JSON file, or "" for a
	// self-portrait.
	Photo string `json:"photo,omitempty"`
	// Portrait is the self-portrait, or nil for a portfolio photo.
	Portrait *BioPortrait `json:"portrait,omitempty"`
}

// BioPortrait is a self-portrait uploaded for the bio alone: it isn't a
// photo file, so no other page of the portfolio shows it.
type BioPortrait struct {
	// Image is the link in R2 of the version the bio shows, at most 1800px
	// on its long edge.
	Image string `json:"image"`
	// Small is the link in R2 of the version at most 500px on its long edge.
	Small string `json:"small"`
	// Width and Height are Image's size in pixels.
	Width  int `json:"width"`
	Height int `json:"height"`
	// Alt is the self-portrait's alt text, or "".
	Alt string `json:"alt"`
}

// SaveBio saves bio as <folder>/bio/bio.json, new or replacing the one
// there, in the pending changes.
func (c *Client) SaveBio(ctx context.Context, gh settings.GitHub, bio Bio) (EntryResult, error) {
	bio, perr := validBio(bio)
	if perr != nil {
		return EntryResult{}, perr
	}
	return c.saveEntry(ctx, gh, BioKind, bio.ID, bio, func([]Entry) *PublishError { return nil })
}

// validBio checks b and returns it as it will be saved, with its photos'
// paths, links and alt texts trimmed.
func validBio(b Bio) (Bio, *PublishError) {
	out := Bio{ID: strings.TrimSpace(b.ID), Text: b.Text}
	if out.ID != BioID {
		return out, publishErr(http.StatusBadRequest, "The bio's ID is %q.", BioID)
	}
	if utf8.RuneCountInString(out.Text) > maxBioText {
		return out, publishErr(http.StatusBadRequest, "Keep the bio to %d characters.", maxBioText)
	}
	if len(b.Photos) > maxBioPhotos {
		return out, publishErr(http.StatusBadRequest, "The bio can have up to %d photos.", maxBioPhotos)
	}
	out.Photos = make([]BioPhoto, 0, len(b.Photos))
	seen := map[string]bool{}
	for i, photo := range b.Photos {
		p, key, perr := validBioPhoto(photo, i+1)
		if perr != nil {
			return out, perr
		}
		if seen[key] {
			return out, publishErr(http.StatusBadRequest, "Photo %d is on the bio twice.", i+1)
		}
		seen[key] = true
		out.Photos = append(out.Photos, p)
	}
	return out, nil
}

// validBioPhoto checks the bio's photo n, and returns it trimmed with what
// tells it from the others: its path, or its self-portrait's link.
func validBioPhoto(photo BioPhoto, n int) (BioPhoto, string, *PublishError) {
	path := strings.TrimSpace(photo.Photo)
	if (path == "") == (photo.Portrait == nil) {
		return photo, "", publishErr(http.StatusBadRequest, "Photo %d needs either a portfolio photo or a self-portrait.", n)
	}
	if photo.Portrait == nil {
		if len(path) > maxBioLinkChars {
			return photo, "", publishErr(http.StatusBadRequest, "Photo %d names a photo file that's too long.", n)
		}
		return BioPhoto{Photo: path}, path, nil
	}
	p := *photo.Portrait
	p.Image, p.Small, p.Alt = strings.TrimSpace(p.Image), strings.TrimSpace(p.Small), strings.TrimSpace(p.Alt)
	if !strings.HasPrefix(p.Image, "https://") || !strings.HasPrefix(p.Small, "https://") ||
		len(p.Image) > maxBioLinkChars || len(p.Small) > maxBioLinkChars {
		return photo, "", publishErr(http.StatusBadRequest, "Self-portrait %d needs the links of its two versions.", n)
	}
	if p.Width <= 0 || p.Height <= 0 {
		return photo, "", publishErr(http.StatusBadRequest, "Self-portrait %d needs its size.", n)
	}
	if utf8.RuneCountInString(p.Alt) > maxBioAlt {
		return photo, "", publishErr(http.StatusBadRequest, "Keep self-portrait %d's alt text to %d characters.", n, maxBioAlt)
	}
	return BioPhoto{Portrait: &p}, p.Image, nil
}
