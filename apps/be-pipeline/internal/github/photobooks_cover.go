package github

import (
	"net/http"
	"regexp"
	"strings"
	"unicode/utf8"
)

// PhotoBookCover is a book's cover from its Cover tab, drawn in the style of
// Serven Up Photos Vol. 3: a plain background, the title large in the top
// left, the author in the bottom left and the volume in the bottom right of
// the front, a plain back, and the spine's text down the spine.
type PhotoBookCover struct {
	// Title is the title on the front, one line of the cover a line, such as
	// "Serven\nUp\nPhotos".
	Title string `json:"title"`
	// Author is the name in the front's bottom left; "" for none.
	Author string `json:"author,omitempty"`
	// Volume is the words in the front's bottom right, such as "Vol. 3"; ""
	// for none.
	Volume string `json:"volume,omitempty"`
	// Spine is the text down the spine; "" for none.
	Spine string `json:"spine,omitempty"`
	// Background is the cover's color as "#rrggbb"; "" for black.
	Background string `json:"background,omitempty"`
	// Color is the cover's text color as "#rrggbb"; "" for white.
	Color string `json:"color,omitempty"`
}

// PhotoBookBlurb is the sizes Blurb asks of the PDFs **PDF for Blurb**
// makes, in inches, from Blurb's specifications for the book's size, paper
// and page count: each page's PDF and the cover's, with the spine's width
// and the bleed on each edge of the cover.
type PhotoBookBlurb struct {
	// PageWidth and PageHeight are the size each page's PDF should measure.
	PageWidth  float64 `json:"pageWidth"`
	PageHeight float64 `json:"pageHeight"`
	// CoverWidth and CoverHeight are the size the cover's PDF should
	// measure, back, spine and front together.
	CoverWidth  float64 `json:"coverWidth"`
	CoverHeight float64 `json:"coverHeight"`
	// Spine is the spine's width, which grows with the page count.
	Spine float64 `json:"spine"`
	// Bleed is how much of each edge of the cover Blurb trims off.
	Bleed float64 `json:"bleed"`
}

// The most characters of a cover's title, and the most inches a Blurb size
// can be.
const (
	maxPhotoBookCoverTitle = 200
	maxPhotoBookBlurbInch  = 100.0
)

// hexColor matches a color written as "#rrggbb".
var hexColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

// validPhotoBookCover returns a book's cover with its words trimmed, or why
// it can't be saved; nil stays nil.
func validPhotoBookCover(cover *PhotoBookCover) (*PhotoBookCover, *PublishError) {
	if cover == nil {
		return nil, nil
	}
	out := PhotoBookCover{
		Title:      strings.TrimSpace(strings.ReplaceAll(cover.Title, "\r\n", "\n")),
		Author:     strings.TrimSpace(cover.Author),
		Volume:     strings.TrimSpace(cover.Volume),
		Spine:      strings.TrimSpace(cover.Spine),
		Background: strings.TrimSpace(cover.Background),
		Color:      strings.TrimSpace(cover.Color),
	}
	if utf8.RuneCountInString(out.Title) > maxPhotoBookCoverTitle {
		return nil, publishErr(http.StatusBadRequest, "Keep the cover's title to %d characters.", maxPhotoBookCoverTitle)
	}
	for _, text := range []string{out.Author, out.Volume, out.Spine} {
		if tooLongEntryText(text) {
			return nil, publishErr(http.StatusBadRequest, "Keep the cover's author, volume and spine to %d characters each.", maxEntryTextLength)
		}
	}
	for _, color := range []string{out.Background, out.Color} {
		if color != "" && !hexColor.MatchString(color) {
			return nil, publishErr(http.StatusBadRequest, "Give the cover's colors as #rrggbb.")
		}
	}
	return &out, nil
}

// validPhotoBookBlurb checks a book's Blurb sizes: each more than 0 (the
// bleed may be 0) and at most maxPhotoBookBlurbInch, with the spine and
// bleed leaving room for the front and back; nil stays nil.
func validPhotoBookBlurb(blurb *PhotoBookBlurb) (*PhotoBookBlurb, *PublishError) {
	if blurb == nil {
		return nil, nil
	}
	for _, side := range []float64{blurb.PageWidth, blurb.PageHeight, blurb.CoverWidth, blurb.CoverHeight, blurb.Spine} {
		if !(side > 0 && side <= maxPhotoBookBlurbInch) {
			return nil, publishErr(http.StatusBadRequest, "Give Blurb's sizes in inches, more than 0 and up to %g.", maxPhotoBookBlurbInch)
		}
	}
	if blurb.Bleed < 0 || blurb.Spine+4*blurb.Bleed >= blurb.CoverWidth || 2*blurb.Bleed >= blurb.CoverHeight {
		return nil, publishErr(http.StatusBadRequest, "Leave room on Blurb's cover for the front and back: the spine and bleed take up all of it.")
	}
	return blurb, nil
}
