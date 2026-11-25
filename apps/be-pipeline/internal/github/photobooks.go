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
	// Two portrait photos side by side on the left, their captions on the
	// right.
	"verticals-left": 2,
	// The same, mirrored: the photos on the right, their captions on the left.
	"verticals-right": 2,
	// One of the book's other pages, such as one the publisher requires or a
	// bio page: no photos, only its name for now.
	"other": 0,
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
	// Album is the ID of the album the book's photos come from, or "" while
	// none is picked.
	Album string `json:"album"`
	// Pages are every page made for the book, ones that could be used,
	// newest last.
	Pages []PhotoBookPage `json:"pages"`
	// Order is the IDs of the pages that will be used, in the book's order;
	// nil in a book made before, whose pages are then all in it. A spread is
	// listed by its first page.
	Order *[]string `json:"order,omitempty"`
	// Size is the printed book's page size, which sets the shape the Photo
	// Book page draws its pages in; nil for the default, BookWright's large
	// landscape page.
	Size *PhotoBookSize `json:"size,omitempty"`
	// Layouts are the page layouts made on the book's Layouts tab, which its
	// pages can have besides the built-in ones.
	Layouts []PhotoBookLayout `json:"layouts,omitempty"`
}

// PhotoBookSize is a book's page size: its width and height in unit.
type PhotoBookSize struct {
	// Width is the page's width, more than 0.
	Width float64 `json:"width"`
	// Height is the page's height, more than 0.
	Height float64 `json:"height"`
	// Unit is "in", "cm", "mm", "pt" or "px".
	Unit string `json:"unit"`
}

// The units a book's page size can be in, and the largest number a side
// can be in any of them.
var (
	photoBookUnits      = []string{"in", "cm", "mm", "pt", "px"}
	maxPhotoBookSideLen = 100000.0
)

// PhotoBookPage is one page of a photo book.
type PhotoBookPage struct {
	// ID tells the page from the others in its book.
	ID string `json:"id"`
	// Name is what the page is called on the Photo Book page, such as
	// "Bicycles, by place"; "" for none.
	Name string `json:"name,omitempty"`
	// LinkNext is true when the page and the one after it among the pages
	// make a two-page spread.
	LinkNext bool `json:"linkNext,omitempty"`
	// Layout is "full", "pair-left", "pair-right", "verticals-left",
	// "verticals-right", "other", or the ID of one of the book's layouts.
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
// and album trimmed, each page with as many slots as its layout holds, and
// its order listing only its pages, each once.
func validPhotoBook(b PhotoBook) (PhotoBook, *PublishError) {
	out := PhotoBook{ID: strings.TrimSpace(b.ID), Name: strings.TrimSpace(b.Name), Template: strings.TrimSpace(b.Template), Album: strings.TrimSpace(b.Album)}
	if perr := validEntryID(PhotoBooks.Name, out.ID); perr != nil {
		return out, perr
	}
	if out.Name == "" {
		return out, publishErr(http.StatusBadRequest, "Give the photo book a name.")
	}
	if slices.ContainsFunc([]string{out.Name, out.Template, out.Album}, tooLongEntryText) {
		return out, publishErr(http.StatusBadRequest, "Keep the name to %d characters.", maxEntryTextLength)
	}
	if len(b.Pages) > maxPhotoBookPages {
		return out, publishErr(http.StatusBadRequest, "A photo book can have up to %d pages.", maxPhotoBookPages)
	}
	layouts, perr := validPhotoBookLayouts(b.Layouts)
	if perr != nil {
		return out, perr
	}
	out.Layouts = layouts
	counts := photoBookSlotCounts(layouts)
	out.Pages = make([]PhotoBookPage, 0, len(b.Pages))
	for i, page := range b.Pages {
		p, perr := validPhotoBookPage(page, i+1, counts)
		if perr != nil {
			return out, perr
		}
		if slices.ContainsFunc(out.Pages, func(o PhotoBookPage) bool { return o.ID == p.ID }) {
			return out, publishErr(http.StatusBadRequest, "Page %d has the same ID as another page.", i+1)
		}
		out.Pages = append(out.Pages, p)
	}
	out.Order = validPhotoBookOrder(b.Order, out.Pages)
	size, perr := validPhotoBookSize(b.Size)
	out.Size = size
	return out, perr
}

// validPhotoBookSize checks a book's page size; nil stays nil.
func validPhotoBookSize(size *PhotoBookSize) (*PhotoBookSize, *PublishError) {
	if size == nil {
		return nil, nil
	}
	if !slices.Contains(photoBookUnits, size.Unit) {
		return nil, publishErr(http.StatusBadRequest, "Give the book's size in in, cm, mm, pt or px.")
	}
	for _, side := range []float64{size.Width, size.Height} {
		if !(side > 0 && side <= maxPhotoBookSideLen) {
			return nil, publishErr(http.StatusBadRequest, "Give the book's width and height as numbers more than 0.")
		}
	}
	return size, nil
}

// validPhotoBookOrder returns order without the IDs of pages that aren't
// there or that it lists twice; nil stays nil.
func validPhotoBookOrder(order *[]string, pages []PhotoBookPage) *[]string {
	if order == nil {
		return nil
	}
	kept := []string{}
	for _, id := range *order {
		there := slices.ContainsFunc(pages, func(p PhotoBookPage) bool { return p.ID == id })
		if there && !slices.Contains(kept, id) {
			kept = append(kept, id)
		}
	}
	return &kept
}

// tooLongEntryText reports whether s is longer than an entry's text can be.
func tooLongEntryText(s string) bool {
	return utf8.RuneCountInString(s) > maxEntryTextLength
}

// validPhotoBookPage checks page n of a book, whose layouts hold counts
// photos, and returns it with its title
// trimmed and its slots cut or filled to its layout's count.
func validPhotoBookPage(page PhotoBookPage, n int, counts map[string]int) (PhotoBookPage, *PublishError) {
	count, ok := counts[page.Layout]
	if !ok {
		return page, publishErr(http.StatusBadRequest, "Page %d has no layout the Photo Book knows.", n)
	}
	out := PhotoBookPage{ID: strings.TrimSpace(page.ID), Name: strings.TrimSpace(page.Name), LinkNext: page.LinkNext, Layout: page.Layout}
	if out.ID == "" || utf8.RuneCountInString(out.ID) > maxEntryTextLength {
		return out, publishErr(http.StatusBadRequest, "Page %d needs an ID.", n)
	}
	if tooLongEntryText(out.Name) {
		return out, publishErr(http.StatusBadRequest, "Keep page %d's name to %d characters.", n, maxEntryTextLength)
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
