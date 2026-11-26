package github

import (
	"net/http"
	"strings"
)

// The smallest size a single entry of a places index can be set to, in
// percent of the list's text size, and the most entries that can have one.
const (
	minEntrySize  = 50
	maxEntrySizes = 500
)

// validEntrySizes returns a places index's single entry sizes as they'll be
// saved: keys trimmed, sizes rounded to steps of 5 from minEntrySize to 100,
// and entries at 100 left out; or why they can't be saved.
func validEntrySizes(sizes map[string]int, n int) (map[string]int, *PublishError) {
	out := map[string]int{}
	for key, size := range sizes {
		key = strings.TrimSpace(key)
		if !knownEntryKey(key) {
			return nil, publishErr(http.StatusBadRequest, "Page %d sizes an entry the places index doesn't have.", n)
		}
		size = min(max((size+2)/5*5, minEntrySize), 100)
		if size < 100 {
			out[key] = size
		}
	}
	if len(out) > maxEntrySizes {
		return nil, publishErr(http.StatusBadRequest, "Page %d can size up to %d entries.", n, maxEntrySizes)
	}
	if len(out) == 0 {
		return nil, nil
	}
	return out, nil
}
