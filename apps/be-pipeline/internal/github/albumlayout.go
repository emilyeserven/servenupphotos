package github

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// The album file fields that hold its cover photos and its layout.
const (
	coversKey = "covers"
	layoutKey = "layout"
)

// The most an album's covers and layout can hold.
const (
	maxCovers       = 5
	maxLayoutRows   = 200
	maxRowPhotos    = 4
	maxRowTextChars = 5000
)

// AlbumRow is one row of an album's layout: Markdown text above it, its
// photos side by side, and Markdown text below it. Every row is written with
// all three keys, empty when it has no text.
type AlbumRow struct {
	// TextAbove is Markdown shown above the row's photos.
	TextAbove string `json:"textAbove"`
	// Photos is the IDs of the row's photos, left to right; empty for a row
	// that's only text.
	Photos []int `json:"photos"`
	// TextBelow is Markdown shown below the row's photos.
	TextBelow string `json:"textBelow"`
}

// AlbumLayout is an album's cover photos and its rows, saved together on its
// page or from an imported album file.
type AlbumLayout struct {
	// Covers is the IDs of up to 5 photos that stand for the album on the
	// portfolio's Albums page; empty for its first 5 photos.
	Covers []int `json:"covers"`
	// Layout is the album's rows; empty for one photo after another.
	Layout []AlbumRow `json:"layout"`
}

// SetAlbumLayout saves layout as the album's "covers" and "layout" in the
// pending changes, with each row's text trimmed. It fails when there are more
// than 5 covers, a cover or row lists an ID that isn't a photo ID, a photo is
// in two rows, a row has more than 4 photos, or a row has neither photos nor
// text.
func (c *Client) SetAlbumLayout(ctx context.Context, gh settings.GitHub, id string, layout AlbumLayout) (AlbumsResult, error) {
	layout = trimmedLayout(layout)
	if perr := checkAlbumLayout(layout); perr != nil {
		return AlbumsResult{}, perr
	}
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return AlbumsResult{}, perr
	}
	album, perr := readableAlbum(w.groups()[Albums.Folder], strings.TrimSpace(id))
	if perr != nil {
		return AlbumsResult{}, perr
	}
	covers, _ := json.Marshal(layout.Covers)
	rows, _ := json.Marshal(layout.Layout)
	return c.saveAlbumEdits(w, []albumEdit{
		{album: album, key: coversKey, value: covers},
		{album: album, key: layoutKey, value: rows},
	})
}

// trimmedLayout is layout with its text trimmed and no nil lists, so each
// is written as [] rather than null.
func trimmedLayout(layout AlbumLayout) AlbumLayout {
	out := AlbumLayout{Covers: append([]int{}, layout.Covers...), Layout: make([]AlbumRow, len(layout.Layout))}
	for i, row := range layout.Layout {
		out.Layout[i] = AlbumRow{
			TextAbove: strings.TrimSpace(row.TextAbove),
			Photos:    append([]int{}, row.Photos...),
			TextBelow: strings.TrimSpace(row.TextBelow),
		}
	}
	return out
}

// checkAlbumLayout fails when layout breaks one of SetAlbumLayout's rules.
func checkAlbumLayout(layout AlbumLayout) *PublishError {
	if len(layout.Covers) > maxCovers {
		return publishErr(http.StatusBadRequest, "An album can have at most %d covers, not %d.", maxCovers, len(layout.Covers))
	}
	if perr := checkPhotoIDs(layout.Covers, "a cover"); perr != nil {
		return perr
	}
	if len(layout.Layout) > maxLayoutRows {
		return publishErr(http.StatusBadRequest, "An album's layout can have at most %d rows, not %d.", maxLayoutRows, len(layout.Layout))
	}
	var placed []int
	for i, row := range layout.Layout {
		if perr := checkAlbumRow(i+1, row); perr != nil {
			return perr
		}
		placed = append(placed, row.Photos...)
	}
	return checkPhotoIDs(placed, "the layout")
}

// checkAlbumRow fails when row, the layout's nth, has too many photos, too
// much text, or nothing in it.
func checkAlbumRow(n int, row AlbumRow) *PublishError {
	if len(row.Photos) > maxRowPhotos {
		return publishErr(http.StatusBadRequest, "Row %d has %d photos; a row can have at most %d.", n, len(row.Photos), maxRowPhotos)
	}
	if len(row.Photos) == 0 && row.TextAbove == "" && row.TextBelow == "" {
		return publishErr(http.StatusBadRequest, "Row %d has no photos and no text.", n)
	}
	for _, text := range []string{row.TextAbove, row.TextBelow} {
		if utf8.RuneCountInString(text) > maxRowTextChars {
			return publishErr(http.StatusBadRequest, "Row %d has text longer than %d characters.", n, maxRowTextChars)
		}
	}
	return nil
}

// checkPhotoIDs fails when an ID in ids isn't a photo ID, a whole number from
// 1, or is listed twice in where, such as "a cover".
func checkPhotoIDs(ids []int, where string) *PublishError {
	seen := map[int]bool{}
	for _, id := range ids {
		if id < 1 {
			return publishErr(http.StatusBadRequest, "%d in %s isn't a photo ID.", id, where)
		}
		if seen[id] {
			return publishErr(http.StatusBadRequest, "Photo %d is in %s twice.", id, where)
		}
		seen[id] = true
	}
	return nil
}
