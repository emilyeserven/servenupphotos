package github

import (
	"context"
	"encoding/json"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// groupNameKey is the album or tag file field that holds its name.
const groupNameKey = "name"

// NormalizeTagNames rewrites the name of every tag whose name isn't its ID to
// its ID, so every tag is named in lowercase kebab-case ("Street Food"
// becomes "street-food"), in the pending changes. Tag files that couldn't be
// read are left as they are. Files counts the tag files that changed.
func (c *Client) NormalizeTagNames(ctx context.Context, gh settings.GitHub) (AlbumsResult, error) {
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return AlbumsResult{}, perr
	}
	var edits []albumEdit
	for _, tag := range w.groups()[Tags.Folder] {
		if tag.Error == "" && tag.Name != tag.ID {
			value, _ := json.Marshal(tag.ID)
			edits = append(edits, albumEdit{album: tag, key: groupNameKey, value: value})
		}
	}
	return c.saveAlbumEdits(w, edits)
}
