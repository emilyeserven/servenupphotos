package github

import (
	"net/http"
	"slices"
	"strings"
)

// PhotoBookLensPrefix is a lens whose name a book's captions write without
// the words it starts with, such as "Fujinon " off "Fujinon XF35mmF2 R WR",
// set on the book's Info tab.
type PhotoBookLensPrefix struct {
	// Lens is the lens's name as the photo's data has it, after camera and
	// lens overrides.
	Lens string `json:"lens"`
	// Prefix is what the captions leave off the start of its name.
	Prefix string `json:"prefix"`
}

// maxPhotoBookLensPrefixes is the most lenses a book can strip a prefix
// from.
const maxPhotoBookLensPrefixes = 100

// validLensPrefixes returns a book's lens prefixes with the lenses trimmed,
// without ones that strip nothing, each lens once; or why they can't be
// saved.
func validLensPrefixes(prefixes []PhotoBookLensPrefix) ([]PhotoBookLensPrefix, *PublishError) {
	var out []PhotoBookLensPrefix
	for _, p := range prefixes {
		p.Lens = strings.TrimSpace(p.Lens)
		if p.Lens == "" || strings.TrimSpace(p.Prefix) == "" {
			continue
		}
		if tooLongEntryText(p.Lens) || tooLongEntryText(p.Prefix) {
			return nil, publishErr(http.StatusBadRequest, "Keep each lens and the prefix taken off it to %d characters.", maxEntryTextLength)
		}
		if slices.ContainsFunc(out, func(o PhotoBookLensPrefix) bool { return o.Lens == p.Lens }) {
			return nil, publishErr(http.StatusBadRequest, "The lens %q has more than one prefix to take off. Keep one.", p.Lens)
		}
		out = append(out, p)
	}
	if len(out) > maxPhotoBookLensPrefixes {
		return nil, publishErr(http.StatusBadRequest, "A photo book can take prefixes off up to %d lenses.", maxPhotoBookLensPrefixes)
	}
	return out, nil
}
