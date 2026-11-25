package github

import (
	"net/http"
	"slices"
	"strings"
)

// PhotoBookLayout is a page layout made on a photo book's Layouts tab: how
// many photos the page holds, how they're arranged and shaped, and where
// the title and captions go, so other layouts can be tried before
// committing to one.
type PhotoBookLayout struct {
	// ID starts with "custom-" and tells the layout from the book's others.
	ID string `json:"id"`
	// Name is what the layout buttons call it, such as "Big pair".
	Name string `json:"name"`
	// Photos is how many photos the page holds, 1 to 4.
	Photos int `json:"photos"`
	// Arrange is "stack" for the photos one under another, or "row" for
	// side by side.
	Arrange string `json:"arrange"`
	// Shape is each photo's place: "landscape" (3:2), "portrait" (2:3),
	// "square", or "fill" for all the room it's given, cropping the photo.
	Shape string `json:"shape"`
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
	// Gap is the room between the photos and the text, in percent of the
	// page's width, 0 to 20.
	Gap float64 `json:"gap"`
	// Margin is the room around the page's edge, in percent of its width,
	// 0 to 20.
	Margin float64 `json:"margin"`
}

// The most layouts a book can have, and what each of a layout's choices
// can be.
var (
	maxPhotoBookLayouts = 50
	layoutChoices       = map[string][]string{
		"arrange":  {"stack", "row"},
		"shape":    {"landscape", "portrait", "square", "fill"},
		"text":     {"left", "right", "above", "below"},
		"captions": {"column", "photo"},
		"align":    {"start", "center", "end"},
	}
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
	for field, value := range map[string]string{"arrange": l.Arrange, "shape": l.Shape, "text": l.Text, "captions": l.Captions, "align": l.Align} {
		if !slices.Contains(layoutChoices[field], value) {
			return l, publishErr(http.StatusBadRequest, "Layout %d's %s has to be one of %s.", n, field, strings.Join(layoutChoices[field], ", "))
		}
	}
	l.TextShare = min(max(l.TextShare, 10), 60)
	l.Gap = min(max(l.Gap, 0), 20)
	l.Margin = min(max(l.Margin, 0), 20)
	return l, nil
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
