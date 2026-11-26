package github

import (
	"net/http"
	"slices"
	"strconv"
	"strings"
)

// The most parts of a photo's location and lines a book photo's caption can
// leave out, the parts other than its places by ID, and the most lines a
// caption can have.
var (
	maxHiddenParts   = 40
	hiddenPartFields = []string{"placeName", "city", "state", "country"}
	maxCaptionLines  = 200
)

// validHiddenPart reports whether part is one a book photo's caption can
// leave out: "place:<id>", "line:<n>" or one of hiddenPartFields.
func validHiddenPart(part string) bool {
	if slices.Contains(hiddenPartFields, part) {
		return true
	}
	if id, ok := strings.CutPrefix(part, "place:"); ok {
		return id != "" && len(id) <= maxEntryTextLength
	}
	if n, ok := strings.CutPrefix(part, "line:"); ok {
		line, err := strconv.Atoi(n)
		return err == nil && line >= 0 && line < maxCaptionLines && strconv.Itoa(line) == n
	}
	return false
}

// validHiddenParts returns the parts of a book photo's location on page n
// and the lines that its caption leaves out, trimmed and without ones listed
// twice; nil when there are none (see validHiddenPart).
func validHiddenParts(hidden []string, n int) ([]string, *PublishError) {
	var out []string
	for _, part := range hidden {
		part = strings.TrimSpace(part)
		if part == "" || slices.Contains(out, part) {
			continue
		}
		if !validHiddenPart(part) {
			return nil, publishErr(http.StatusBadRequest, "A photo on page %d hides a part of its caption that isn't one: %q.", n, part)
		}
		out = append(out, part)
	}
	if len(out) > maxHiddenParts {
		return nil, publishErr(http.StatusBadRequest, "A photo on page %d can hide up to %d parts of its caption.", n, maxHiddenParts)
	}
	return out, nil
}
