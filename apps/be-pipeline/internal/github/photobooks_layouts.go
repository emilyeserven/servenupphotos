package github

import (
	"net/http"
	"slices"
	"strings"
)

// PhotoBookLayout is a page layout made on a photo book's Layouts tab: how
// many photos the page holds, how they're arranged and shaped, and where
// the title and captions go, so other layouts can be tried before
// committing to one. Its look is for right-hand (odd) pages; LeftPages
// says what left-hand (even) pages get.
type PhotoBookLayout struct {
	// ID starts with "custom-" and tells the layout from the book's others.
	ID string `json:"id"`
	// Name is what the layout buttons call it, such as "Big pair".
	Name string `json:"name"`
	// Photos is how many photos the page holds, 1 to 4.
	Photos int `json:"photos"`
	PhotoBookLayoutLook
	// LeftPages is what left-hand pages get: "mirror" for the look turned
	// around, "own" for Left, or "same" (or "", in a layout made before)
	// for the same look.
	LeftPages string `json:"leftPages,omitempty"`
	// Left is the look of left-hand pages when LeftPages is "own".
	Left *PhotoBookLayoutLook `json:"left,omitempty"`
}

// PhotoBookLayoutLook is how a layout draws a page: its photos' arrangement
// and shape, and where its text goes.
type PhotoBookLayoutLook struct {
	// Arrange is "stack" for the photos one under another, or "row" for
	// side by side.
	Arrange string `json:"arrange"`
	// Shape is each photo's place: "landscape" (3:2), "portrait" (2:3),
	// "square", "ratio" for Ratio's, or "fill" for all the room it's given,
	// cropping the photo.
	Shape string `json:"shape"`
	// Ratio is the photos' width and height, such as 4 and 5, when Shape is
	// "ratio"; nil otherwise.
	Ratio *PhotoBookRatio `json:"ratio,omitempty"`
	// Text is the side the title and captions go on: "left", "right",
	// "above" or "below".
	Text string `json:"text"`
	// Captions is "column" for the title and every caption together on one
	// side of the photos, or "photo" for each caption beside its own photo.
	Captions string `json:"captions"`
	// TextShare is the share of the page's width (or height, above or
	// below) the text takes, in percent, 10 to 60.
	TextShare float64 `json:"textShare"`
	// Align is where the text sits in its room: "start", "center" or "end".
	Align string `json:"align"`
	// AlignTo is what Align lines the text up with: "photo" for the edges
	// of the photos as drawn, or "room" (or "", in a layout made before)
	// for all the room the photos are given.
	AlignTo string `json:"alignTo,omitempty"`
	// Gap is the room between the photos and the text, in percent of the
	// page's width, 0 to 20.
	Gap float64 `json:"gap"`
	// Margin is the room around the page's edge, in percent of its width,
	// 0 to 20.
	Margin float64 `json:"margin"`
}

// PhotoBookRatio is a photo place's aspect ratio, its width to its height.
type PhotoBookRatio struct {
	// Width is more than 0 and at most 100.
	Width float64 `json:"width"`
	// Height is more than 0 and at most 100.
	Height float64 `json:"height"`
}

// The most layouts a book can have, and what each of a layout's choices
// can be.
var (
	maxPhotoBookLayouts = 50
	layoutChoices       = map[string][]string{
		"arrange":  {"stack", "row"},
		"shape":    {"landscape", "portrait", "square", "ratio", "fill"},
		"text":     {"left", "right", "above", "below"},
		"captions": {"column", "photo"},
		"align":    {"start", "center", "end"},
		"alignTo":  {"", "room", "photo"},
	}
	leftPagesChoices = []string{"", "same", "mirror", "own"}
)

// validPhotoBookLayouts checks a book's layouts and returns them with their
// names trimmed and their numbers kept in range.
func validPhotoBookLayouts(layouts []PhotoBookLayout) ([]PhotoBookLayout, *PublishError) {
	if len(layouts) > maxPhotoBookLayouts {
		return nil, publishErr(http.StatusBadRequest, "A photo book can have up to %d layouts.", maxPhotoBookLayouts)
	}
	out := make([]PhotoBookLayout, 0, len(layouts))
	for i, layout := range layouts {
		l, perr := validPhotoBookLayout(layout, i+1)
		if perr != nil {
			return nil, perr
		}
		if slices.ContainsFunc(out, func(o PhotoBookLayout) bool { return o.ID == l.ID }) {
			return nil, publishErr(http.StatusBadRequest, "Layout %d has the same ID as another layout.", i+1)
		}
		out = append(out, l)
	}
	return out, nil
}

// validPhotoBookLayout checks layout n of a book.
func validPhotoBookLayout(l PhotoBookLayout, n int) (PhotoBookLayout, *PublishError) {
	l.ID = strings.TrimSpace(l.ID)
	l.Name = strings.TrimSpace(l.Name)
	if !strings.HasPrefix(l.ID, "custom-") || tooLongEntryText(l.ID) {
		return l, publishErr(http.StatusBadRequest, "Layout %d needs an ID that starts with \"custom-\".", n)
	}
	if l.Name == "" || tooLongEntryText(l.Name) {
		return l, publishErr(http.StatusBadRequest, "Give layout %d a name of up to %d characters.", n, maxEntryTextLength)
	}
	if l.Photos < 1 || l.Photos > 4 {
		return l, publishErr(http.StatusBadRequest, "Layout %d can hold 1 to 4 photos.", n)
	}
	look, perr := validLayoutLook(l.PhotoBookLayoutLook, n)
	if perr != nil {
		return l, perr
	}
	l.PhotoBookLayoutLook = look
	return validLeftPages(l, n)
}

// validLeftPages checks what layout n gives left-hand pages: Left is kept
// only when LeftPages is "own", and then has to be there.
func validLeftPages(l PhotoBookLayout, n int) (PhotoBookLayout, *PublishError) {
	if !slices.Contains(leftPagesChoices, l.LeftPages) {
		return l, publishErr(http.StatusBadRequest, "Layout %d's left pages have to be the same, mirrored or their own.", n)
	}
	if l.LeftPages != "own" {
		l.Left = nil
		return l, nil
	}
	if l.Left == nil {
		return l, publishErr(http.StatusBadRequest, "Give layout %d's left pages their own settings.", n)
	}
	left, perr := validLayoutLook(*l.Left, n)
	l.Left = &left
	return l, perr
}

// validLayoutLook checks a look of layout n and returns it with its numbers
// kept in range and its ratio only when its shape takes one.
func validLayoutLook(l PhotoBookLayoutLook, n int) (PhotoBookLayoutLook, *PublishError) {
	for field, value := range map[string]string{"arrange": l.Arrange, "shape": l.Shape, "text": l.Text, "captions": l.Captions, "align": l.Align, "alignTo": l.AlignTo} {
		if !slices.Contains(layoutChoices[field], value) {
			return l, publishErr(http.StatusBadRequest, "Layout %d's %s has to be one of %s.", n, field, strings.Join(layoutChoices[field], ", "))
		}
	}
	if l.Shape != "ratio" {
		l.Ratio = nil
	} else if l.Ratio == nil || !validRatioSide(l.Ratio.Width) || !validRatioSide(l.Ratio.Height) {
		return l, publishErr(http.StatusBadRequest, "Give layout %d's photo ratio a width and height from 0 to 100.", n)
	}
	l.TextShare = min(max(l.TextShare, 10), 60)
	l.Gap = min(max(l.Gap, 0), 20)
	l.Margin = min(max(l.Margin, 0), 20)
	return l, nil
}

// validHiddenLayouts returns the built-in layouts a book hides from its
// pages' layout pickers, each once; a name that isn't one is refused.
func validHiddenLayouts(hidden []string) ([]string, *PublishError) {
	var out []string
	for _, id := range hidden {
		if photoBookLayouts[id] == 0 {
			return nil, publishErr(http.StatusBadRequest, "Only a built-in photo layout can be hidden, not %q.", id)
		}
		if !slices.Contains(out, id) {
			out = append(out, id)
		}
	}
	return out, nil
}

// photoBookSlotCounts is how many photos each layout a book's pages can
// have holds: the built-in ones and the book's own.
func photoBookSlotCounts(layouts []PhotoBookLayout) map[string]int {
	counts := make(map[string]int, len(photoBookLayouts)+len(layouts))
	for id, n := range photoBookLayouts {
		counts[id] = n
	}
	for _, l := range layouts {
		counts[l.ID] = l.Photos
	}
	return counts
}

// validRatioSide reports whether side can be one side of a photo ratio.
func validRatioSide(side float64) bool {
	return side > 0 && side <= 100
}
