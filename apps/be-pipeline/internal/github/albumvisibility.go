package github

import (
	"context"
	"strconv"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// hiddenKey is the album file field that hides the album on the portfolio.
const hiddenKey = "hidden"

// SetAlbumHidden saves whether the portfolio hides the album, as its file's
// "hidden", in the pending changes. A hidden album, and every album inside
// it, isn't on the portfolio's Albums page, its album filter or its own page;
// its photos still show everywhere else, and a spotlight spot still shows it.
func (c *Client) SetAlbumHidden(ctx context.Context, gh settings.GitHub, id string, hidden bool) (AlbumsResult, error) {
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return AlbumsResult{}, perr
	}
	album, perr := readableAlbum(w.groups()[Albums.Folder], strings.TrimSpace(id))
	if perr != nil {
		return AlbumsResult{}, perr
	}
	if album.Hidden == hidden {
		return AlbumsResult{pendingSave: w.pendingSave(nil)}, nil
	}
	value := []byte(strconv.FormatBool(hidden))
	return c.saveAlbumEdits(w, []albumEdit{{album: album, key: hiddenKey, value: value}})
}
