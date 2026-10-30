package github

import (
	"context"
	"maps"
	"net/http"
	"slices"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// groupDescriptionKey is the album or tag file field that holds its description.
const groupDescriptionKey = "description"

// maxTagDescription is the longest description, in characters, a tag can be
// given at once: a few sentences, far more than the one line asked for.
const maxTagDescription = 1000

// SetTagDescriptions saves each description in descriptions, by tag ID, as
// that tag's "description", trimmed, in the pending changes. A tag that
// already has that description is left as it is; Files counts the tag files
// that changed. Nothing is saved when an ID isn't a tag, a tag's file
// couldn't be read, or a description is empty or too long.
func (c *Client) SetTagDescriptions(ctx context.Context, gh settings.GitHub, descriptions map[string]string) (AlbumsResult, error) {
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return AlbumsResult{}, perr
	}
	tags := w.groups()[Tags.Folder]
	edits := make([]albumEdit, 0, len(descriptions))
	for _, id := range slices.Sorted(maps.Keys(descriptions)) {
		edit, perr := tagDescriptionEdit(tags, id, descriptions[id])
		if perr != nil {
			return AlbumsResult{}, perr
		}
		edits = append(edits, edit)
	}
	return c.saveAlbumEdits(w, edits)
}

// tagDescriptionEdit is the edit that gives the tag id the description text,
// failing when there's no such tag or the text can't be its description.
func tagDescriptionEdit(tags []Group, id, text string) (albumEdit, *PublishError) {
	tag, perr := readableGroup(Tags, tags, strings.TrimSpace(id))
	if perr != nil {
		return albumEdit{}, perr
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return albumEdit{}, publishErr(http.StatusBadRequest, "The description for %q is empty.", tag.ID)
	}
	if len([]rune(text)) > maxTagDescription {
		return albumEdit{}, publishErr(http.StatusBadRequest, "The description for %q is longer than %d characters.", tag.ID, maxTagDescription)
	}
	return albumEdit{album: tag, key: groupDescriptionKey, value: []byte(quoteJSON(text))}, nil
}
