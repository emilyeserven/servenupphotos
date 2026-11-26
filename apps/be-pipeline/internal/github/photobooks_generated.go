package github

import (
	"net/http"
	"slices"
	"strings"
)

// PhotoBookGenerated is what a generated page draws from the book's own
// data each time it's shown, such as a Places Index, and its options. It's
// set only on one of the book's other pages (layout "other").
type PhotoBookGenerated struct {
	// Kind is what the page is made from: "places-index" for the places
	// the book's photos show, as a hierarchy of countries, states, cities
	// and places.
	Kind string `json:"kind"`
	// Names is how names are written, from their localizations:
	// "romanized" in Latin letters, "romanizedLocal" with their own script
	// after (Gyeongbokgung (경복궁)), "localRomanized" with it before
	// (경복궁 (Gyeongbokgung)), "local" in their own script only, or ""
	// (absent) as photos and places have them.
	Names string `json:"names,omitempty"`
	// Localized is true in a page saved before Names for "localRomanized";
	// it's saved as Names.
	Localized bool `json:"localized,omitempty"`
	// StateAbbreviations is true when US states are written in their
	// standard abbreviation, such as CA for California.
	StateAbbreviations bool `json:"stateAbbreviations,omitempty"`
	// Depth is the most specific level listed: "country", "state", "city",
	// or "" (absent) for every place.
	Depth string `json:"depth,omitempty"`
	// Order is "book" to list places in the order the book first shows
	// them, or "" (absent) for alphabetical order.
	Order string `json:"order,omitempty"`
	// Columns is how many columns the index flows into, 2 or 3; 0 (absent)
	// for one.
	Columns int `json:"columns,omitempty"`
	// Pages is how many linked pages the list runs on across, 2 to
	// maxGeneratedPages; 0 (absent) for one.
	Pages int `json:"pages,omitempty"`
	// Hidden are the entries left out of the index, their places lifted
	// into the entry above: "country:<name>", "state:<name>",
	// "city:<name>", "place:<place ID>" or "placeName:<text>".
	Hidden []string `json:"hidden,omitempty"`
}

// The kinds of generated page, the levels a Places Index can stop at, and
// the orders it can list in.
var (
	generatedPageKinds  = []string{"places-index"}
	placesIndexDepths   = []string{"", "country", "state", "city"}
	placesIndexOrders   = []string{"", "book"}
	placesIndexNames    = []string{"", "romanized", "romanizedLocal", "localRomanized", "local"}
	placesIndexHideKind = []string{"country:", "state:", "city:", "place:", "placeName:"}
)

// maxGeneratedHidden is the most entries a generated page can leave out,
// and maxGeneratedPages the most pages it can run on across.
const (
	maxGeneratedHidden = 500
	maxGeneratedPages  = 20
)

// validGeneratedPage returns page n's generated settings as they'll be
// saved: none on a page that isn't an other page, and otherwise its options
// checked, `localized` saved as Names, columns from 1 to maxTextPageColumns
// and pages from 1 to maxGeneratedPages, each with 1 as 0, and its hidden
// entries trimmed, each once.
func validGeneratedPage(page PhotoBookPage, n int) (*PhotoBookGenerated, *PublishError) {
	g := page.Generated
	if g == nil || page.Layout != "other" {
		return nil, nil
	}
	if !slices.Contains(generatedPageKinds, g.Kind) {
		return nil, publishErr(http.StatusBadRequest, "Page %d is generated from something the Photo Book doesn't know.", n)
	}
	if !slices.Contains(placesIndexDepths, g.Depth) || !slices.Contains(placesIndexOrders, g.Order) {
		return nil, publishErr(http.StatusBadRequest, "Page %d's places index has a level or order the Photo Book doesn't know.", n)
	}
	if !slices.Contains(placesIndexNames, g.Names) {
		return nil, publishErr(http.StatusBadRequest, "Page %d's places index writes names in a way the Photo Book doesn't know.", n)
	}
	out := *g
	if out.Localized && out.Names == "" {
		out.Names = "localRomanized"
	}
	out.Localized = false
	out.Columns = oneAsZero(min(max(g.Columns, 1), maxTextPageColumns))
	out.Pages = oneAsZero(min(max(g.Pages, 1), maxGeneratedPages))
	hidden, perr := validGeneratedHidden(g.Hidden, n)
	out.Hidden = hidden
	return &out, perr
}

// oneAsZero is n, with 1 as 0, so a count left at one isn't saved.
func oneAsZero(n int) int {
	if n == 1 {
		return 0
	}
	return n
}

// validGeneratedHidden returns a generated page's hidden entries trimmed,
// each once, or why they can't be saved.
func validGeneratedHidden(hidden []string, n int) ([]string, *PublishError) {
	var out []string
	for _, key := range hidden {
		key = strings.TrimSpace(key)
		if key == "" || slices.Contains(out, key) {
			continue
		}
		known := slices.ContainsFunc(placesIndexHideKind, func(prefix string) bool {
			return strings.HasPrefix(key, prefix) && len(key) > len(prefix)
		})
		if !known || tooLongEntryText(key) {
			return nil, publishErr(http.StatusBadRequest, "Page %d hides an entry the places index doesn't have.", n)
		}
		out = append(out, key)
	}
	if len(out) > maxGeneratedHidden {
		return nil, publishErr(http.StatusBadRequest, "Page %d can hide up to %d entries.", n, maxGeneratedHidden)
	}
	return out, nil
}
