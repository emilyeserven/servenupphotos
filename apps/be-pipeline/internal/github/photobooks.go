package github

import (
	"context"
	"net/http"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// The page layouts a photo book's page can have, and how many photos each
// holds.
var photoBookLayouts = map[string]int{
	// One photo over the whole page, its caption at the bottom.
	"full": 1,
	// Two photos down the left side, their captions beside them on the right.
	"pair-left": 2,
	// Two photos down the right side, their captions beside them on the left.
	"pair-right": 2,
}

// The most pages a photo book can have, and the most characters of a
// caption written by hand.
const (
	maxPhotoBookPages     = 500
	maxPhotoBookCaption   = 2000
	maxPhotoBookPathChars = 500
)

// PhotoBook is a photo book file: a rough mockup of a photo book's pages,
// made on the Photo Book page to plan one before laying it out for real.
type PhotoBook struct {
	// ID is made from the name when the book is made, and kept after that.
	ID string `json:"id"`
	// Name is how the Photo Book page lists it, such as "Korea 2026".
	Name string `json:"name"`
	// Template is the ID of the caption template its captions are filled in
	// with, or "" for the page's default.
	Template string `json:"template"`
	// Pages are the book's pages, first to last.
	Pages []PhotoBookPage `json:"pages"`
}

// PhotoBookPage is one page of a photo book.
type PhotoBookPage struct {
	// ID tells the page from the others in its book.
	ID string `json:"id"`
	// Layout is "full", "pair-left" or "pair-right".
	Layout string `json:"layout"`
	// Title is shown above the page's top photo; nil for none.
	Title *string `json:"title"`
	// Slots are the page's photo places, as many as its layout holds.
	Slots []PhotoBookSlot `json:"slots"`
}

// PhotoBookSlot is one photo's place on a page, with its caption.
type PhotoBookSlot struct {
	// Photo is the photo file's path, or "" while the place is empty.
	Photo string `json:"photo"`
	// Caption is a caption written by hand; nil to fill it in from the
	// photo with the book's caption template.
	Caption *string `json:"caption"`
}

// SavePhotoBook saves book as <folder>/photobooks/<id>.json, new or
// replacing the one there, in the pending changes.
func (c *Client) SavePhotoBook(ctx context.Context, gh settings.GitHub, book PhotoBook) (EntryResult, error) {
	book, perr := validPhotoBook(book)
	if perr != nil {
		return EntryResult{}, perr
	}
	return c.saveEntry(ctx, gh, PhotoBooks, book.ID, book, func([]Entry) *PublishError { return nil })
}

// DeletePhotoBook removes the photo book named id in the pending changes.
func (c *Client) DeletePhotoBook(ctx context.Context, gh settings.GitHub, id string) (EntryResult, error) {
	return c.deleteEntry(ctx, gh, PhotoBooks, id, func([]Entry) *PublishError { return nil })
}

// validPhotoBook checks b and returns it as it will be saved: its name
// trimmed, and each page with as many slots as its layout holds.
func validPhotoBook(b PhotoBook) (PhotoBook, *PublishError) {
	out := PhotoBook{ID: strings.TrimSpace(b.ID), Name: strings.TrimSpace(b.Name), Template: strings.TrimSpace(b.Template)}
	if perr := validEntryID(PhotoBooks.Name, out.ID); perr != nil {
		return out, perr
	}
	if out.Name == "" {
		return out, publishErr(http.StatusBadRequest, "Give the photo book a name.")
	}
	if utf8.RuneCountInString(out.Name) > maxEntryTextLength || utf8.RuneCountInString(out.Template) > maxEntryTextLength {
		return out, publishErr(http.StatusBadRequest, "Keep the name to %d characters.", maxEntryTextLength)
	}
	if len(b.Pages) > maxPhotoBookPages {
		return out, publishErr(http.StatusBadRequest, "A photo book can have up to %d pages.", maxPhotoBookPages)
	}
	out.Pages = make([]PhotoBookPage, 0, len(b.Pages))
	for i, page := range b.Pages {
		p, perr := validPhotoBookPage(page, i+1)
		if perr != nil {
			return out, perr
		}
		if slices.ContainsFunc(out.Pages, func(o PhotoBookPage) bool { return o.ID == p.ID }) {
			return out, publishErr(http.StatusBadRequest, "Page %d has the same ID as another page.", i+1)
		}
		out.Pages = append(out.Pages, p)
	}
	return out, nil
}

// validPhotoBookPage checks page n of a book, and returns it with its title
// trimmed and its slots cut or filled to its layout's count.
func validPhotoBookPage(page PhotoBookPage, n int) (PhotoBookPage, *PublishError) {
	count, ok := photoBookLayouts[page.Layout]
	if !ok {
		return page, publishErr(http.StatusBadRequest, "Page %d has no layout the Photo Book knows.", n)
	}
	out := PhotoBookPage{ID: strings.TrimSpace(page.ID), Layout: page.Layout}
	if out.ID == "" || utf8.RuneCountInString(out.ID) > maxEntryTextLength {
		return out, publishErr(http.StatusBadRequest, "Page %d needs an ID.", n)
	}
	if page.Title != nil {
		title := strings.TrimSpace(*page.Title)
		if utf8.RuneCountInString(title) > maxEntryTextLength {
			return out, publishErr(http.StatusBadRequest, "Keep page %d's title to %d characters.", n, maxEntryTextLength)
		}
		out.Title = &title
	}
	out.Slots = make([]PhotoBookSlot, count)
	for i := range min(count, len(page.Slots)) {
		slot, perr := validPhotoBookSlot(page.Slots[i], n)
		if perr != nil {
			return out, perr
		}
		out.Slots[i] = slot
	}
	return out, nil
}

// validPhotoBookSlot checks a photo's place on page n.
func validPhotoBookSlot(slot PhotoBookSlot, n int) (PhotoBookSlot, *PublishError) {
	out := PhotoBookSlot{Photo: strings.TrimSpace(slot.Photo), Caption: slot.Caption}
	if len(out.Photo) > maxPhotoBookPathChars {
		return out, publishErr(http.StatusBadRequest, "Page %d names a photo file that's too long.", n)
	}
	if out.Caption != nil && utf8.RuneCountInString(*out.Caption) > maxPhotoBookCaption {
		return out, publishErr(http.StatusBadRequest, "Keep each caption on page %d to %d characters.", n, maxPhotoBookCaption)
	}
	return out, nil
}
