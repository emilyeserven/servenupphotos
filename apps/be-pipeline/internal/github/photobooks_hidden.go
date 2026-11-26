package github

import (
	"net/http"
	"slices"
	"strings"
)

// The most parts of a photo's location a book photo's caption can leave
// out, and the parts other than its places by ID.
var (
	maxHiddenParts   = 20
	hiddenPartFields = []string{"placeName", "city", "state", "country"}
)

// validHiddenParts returns the parts of a book photo's location on page n
// that its caption leaves out, trimmed and without ones listed twice; nil
// when there are none. Each is "place:<id>" or one of hiddenPartFields.
func validHiddenParts(hidden []string, n int) ([]string, *PublishError) {
	var out []string
	for _, part := range hidden {
		part = strings.TrimSpace(part)
		if part == "" || slices.Contains(out, part) {
			continue
		}
		id, isPlace := strings.CutPrefix(part, "place:")
		if !slices.Contains(hiddenPartFields, part) && (!isPlace || id == "" || len(id) > maxEntryTextLength) {
			return nil, publishErr(http.StatusBadRequest, "A photo on page %d hides a part of its location that isn't one: %q.", n, part)
		}
		out = append(out, part)
	}
	if len(out) > maxHiddenParts {
		return nil, publishErr(http.StatusBadRequest, "A photo on page %d can hide up to %d parts of its location.", n, maxHiddenParts)
	}
	return out, nil
}
