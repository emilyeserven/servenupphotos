package github

import (
	"context"
	"net/http"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// StandardLayoutsID is the ID of the one standard layouts file,
// booklayouts/standard.json.
const StandardLayoutsID = "standard"

// StandardLayouts is the standard layouts file: layouts saved from one
// photo book's Layouts tab for every book to use, and the built-in layouts
// every book leaves out of its pages' layout pickers.
type StandardLayouts struct {
	// ID is always StandardLayoutsID: there's one file.
	ID string `json:"id"`
	// Layouts are the standard layouts, in the order the Layouts tab lists
	// them. A book adds a copy of one to its own layouts to use it.
	Layouts []PhotoBookLayout `json:"layouts"`
	// HiddenLayouts are the built-in layouts hidden in every book, on top
	// of the ones each book hides itself.
	HiddenLayouts []string `json:"hiddenLayouts,omitempty"`
}

// SaveStandardLayouts saves layouts as <folder>/booklayouts/standard.json,
// new or replacing the one there, in the pending changes.
func (c *Client) SaveStandardLayouts(ctx context.Context, gh settings.GitHub, layouts StandardLayouts) (EntryResult, error) {
	layouts, perr := validStandardLayouts(layouts)
	if perr != nil {
		return EntryResult{}, perr
	}
	return c.saveEntry(ctx, gh, BookLayouts, layouts.ID, layouts, func([]Entry) *PublishError { return nil })
}

// validStandardLayouts checks s and returns it as it will be saved: each
// layout checked as a book's are, and each hidden built-in layout once.
func validStandardLayouts(s StandardLayouts) (StandardLayouts, *PublishError) {
	out := StandardLayouts{ID: strings.TrimSpace(s.ID)}
	if out.ID != StandardLayoutsID {
		return out, publishErr(http.StatusBadRequest, "The standard layouts file's ID is %q.", StandardLayoutsID)
	}
	layouts, perr := validPhotoBookLayouts(s.Layouts)
	if perr != nil {
		return out, perr
	}
	for i := range layouts {
		layouts[i].Standard = ""
	}
	out.Layouts = layouts
	out.HiddenLayouts, perr = validHiddenLayouts(s.HiddenLayouts)
	return out, perr
}
