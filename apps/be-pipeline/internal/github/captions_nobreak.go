package github

import (
	"net/http"
	"slices"
	"strings"
)

// maxCaptionNoBreak is the most values that never break a caption template
// can have.
const maxCaptionNoBreak = 100

// validNoBreak returns a caption template's values that never break, each
// trimmed and kept once, without empty ones, or why they can't be saved.
func validNoBreak(values []string) ([]string, *PublishError) {
	var out []string
	for _, v := range values {
		v = strings.TrimSpace(v)
		if v == "" || slices.Contains(out, v) {
			continue
		}
		if tooLongEntryText(v) {
			return nil, publishErr(http.StatusBadRequest, "Keep each value that never breaks to %d characters.", maxEntryTextLength)
		}
		out = append(out, v)
	}
	if len(out) > maxCaptionNoBreak {
		return nil, publishErr(http.StatusBadRequest, "A caption template can have up to %d values that never break.", maxCaptionNoBreak)
	}
	return out, nil
}
