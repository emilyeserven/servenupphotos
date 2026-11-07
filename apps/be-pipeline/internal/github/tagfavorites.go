package github

import (
	"context"
	"maps"
	"slices"
	"strconv"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// favoriteKey is the tag file field that marks a favorite tag.
const favoriteKey = "favorite"

// SetTagFavorites saves whether each tag in favorites, by tag ID, is a
// favorite, as its file's "favorite", in the pending changes. Favorite tags
// come first in the pipeline's tag lists and the Tags field, and at the top
// of the portfolio's Tags page. A tag that already has that value is left as
// it is; Files counts the tag files that changed. Nothing is saved when an
// ID isn't a tag or a tag's file couldn't be read.
func (c *Client) SetTagFavorites(ctx context.Context, gh settings.GitHub, favorites map[string]bool) (AlbumsResult, error) {
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return AlbumsResult{}, perr
	}
	tags := w.groups()[Tags.Folder]
	edits := make([]albumEdit, 0, len(favorites))
	for _, id := range slices.Sorted(maps.Keys(favorites)) {
		tag, perr := readableGroup(Tags, tags, strings.TrimSpace(id))
		if perr != nil {
			return AlbumsResult{}, perr
		}
		if tag.Favorite == favorites[id] {
			continue
		}
		value := []byte(strconv.FormatBool(favorites[id]))
		edits = append(edits, albumEdit{album: tag, key: favoriteKey, value: value})
	}
	return c.saveAlbumEdits(w, edits)
}
