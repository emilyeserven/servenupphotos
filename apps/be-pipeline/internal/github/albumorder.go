package github

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"strconv"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// The album file fields that hold its place among the albums, the
// portfolio's spots that show its photos, and its photos' order.
const (
	orderKey          = "order"
	spotlightZonesKey = "spotlightZones"
	photoOrderKey     = "photoOrder"
)

// AlbumsResult says which album files a change to several albums saved.
type AlbumsResult struct {
	pendingSave
	// Files is how many album files changed; the others already had it.
	Files int `json:"files"`
}

// albumEdit is the new value of one top-level field of an album file.
type albumEdit struct {
	album Group
	key   string
	value []byte
}

// SetAlbumOrder gives each album in ids its place there, 1 first, as each
// file's "order", in the pending changes. Albums left out keep theirs. It
// fails when an ID isn't an album, or is listed twice.
func (c *Client) SetAlbumOrder(ctx context.Context, gh settings.GitHub, ids []string) (AlbumsResult, error) {
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return AlbumsResult{}, perr
	}
	albums := w.groups()[Albums.Folder]
	edits := make([]albumEdit, 0, len(ids))
	seen := map[string]bool{}
	for i, id := range ids {
		album, perr := readableAlbum(albums, strings.TrimSpace(id))
		if perr != nil {
			return AlbumsResult{}, perr
		}
		if seen[album.ID] {
			return AlbumsResult{}, publishErr(http.StatusBadRequest, "%q is in the order twice.", album.ID)
		}
		seen[album.ID] = true
		edits = append(edits, albumEdit{album: album, key: orderKey, value: []byte(strconv.Itoa(i + 1))})
	}
	return c.saveAlbumEdits(w, edits)
}

// SetAlbumPhotoOrder saves photoIDs, photo IDs in the order the portfolio
// shows them, as the album's "photoOrder" in the pending changes. Its photos
// left out come after the listed ones, in the default order, and an empty
// list puts them all back in the default order. It fails when an ID isn't a
// photo ID or is listed twice.
func (c *Client) SetAlbumPhotoOrder(ctx context.Context, gh settings.GitHub, id string, photoIDs []int) (AlbumsResult, error) {
	if perr := checkPhotoOrder(photoIDs); perr != nil {
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
	value, _ := json.Marshal(append([]int{}, photoIDs...))
	return c.saveAlbumEdits(w, []albumEdit{{album: album, key: photoOrderKey, value: value}})
}

// checkPhotoOrder fails when an ID in photoIDs isn't a photo ID, a whole
// number from 1, or is listed twice.
func checkPhotoOrder(photoIDs []int) *PublishError {
	return checkPhotoIDs(photoIDs, "the order")
}

// SetSpotlightAlbum makes album the one whose photos the portfolio's spot
// zone shows, adding zone to its file's "spotlightZones" and taking it out of
// every other album's, in the pending changes. An empty album leaves the spot
// without one.
func (c *Client) SetSpotlightAlbum(ctx context.Context, gh settings.GitHub, zone, album string) (AlbumsResult, error) {
	zone, album = strings.TrimSpace(zone), strings.TrimSpace(album)
	if !groupIDPattern.MatchString(zone) {
		return AlbumsResult{}, publishErr(http.StatusBadRequest, "%q isn't a spotlight spot.", zone)
	}
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return AlbumsResult{}, perr
	}
	albums := w.groups()[Albums.Folder]
	if album != "" {
		if _, perr := readableAlbum(albums, album); perr != nil {
			return AlbumsResult{}, perr
		}
	}
	var edits []albumEdit
	for _, a := range albums {
		if edit, ok := zoneEdit(a, zone, a.ID == album); ok {
			edits = append(edits, edit)
		}
	}
	return c.saveAlbumEdits(w, edits)
}

// zoneEdit is the edit that puts album in zone, or takes it out, and false
// when it's already that way or its file couldn't be read.
func zoneEdit(album Group, zone string, in bool) (albumEdit, bool) {
	zones := slices.DeleteFunc(slices.Clone(album.SpotlightZones), func(z string) bool { return z == zone })
	if in {
		zones = append(zones, zone)
	}
	if album.Error != "" || slices.Equal(zones, album.SpotlightZones) {
		return albumEdit{}, false
	}
	value, _ := json.Marshal(append([]string{}, zones...))
	return albumEdit{album: album, key: spotlightZonesKey, value: value}, true
}

// readableAlbum is the album in albums with id, failing when there's none or
// its file couldn't be read.
func readableAlbum(albums []Group, id string) (Group, *PublishError) {
	return readableGroup(Albums, albums, id)
}

// readableGroup is the album, tag or genre of kind in groups with id, failing
// when there's none or its file couldn't be read.
func readableGroup(kind Kind, groups []Group, id string) (Group, *PublishError) {
	album, ok := findGroup(groups, id)
	if !ok {
		return Group{}, publishErr(http.StatusNotFound, "There's no %s with the ID %q. Refresh to see what there is.", kind.Name, id)
	}
	if album.Error != "" {
		return Group{}, publishErr(http.StatusConflict, "%s couldn't be read (%s), so it wasn't changed.", album.Path, album.Error)
	}
	return album, nil
}

// saveAlbumEdits saves the album files that edits change as pending changes,
// skipping the ones that already have their value.
func (c *Client) saveAlbumEdits(w *workspace, edits []albumEdit) (AlbumsResult, error) {
	changes, perr := albumChanges(w, edits)
	if perr != nil {
		return AlbumsResult{}, perr
	}
	result := AlbumsResult{pendingSave: w.pendingSave(nil), Files: len(changes)}
	if len(changes) == 0 {
		return result, nil
	}
	saved, perr := c.saveFiles(w, changes)
	if perr != nil {
		return AlbumsResult{}, perr
	}
	result.pendingSave = saved
	return result, nil
}

// albumChanges is each album file with every one of edits made to it, in
// order, leaving out the files they don't change.
func albumChanges(w *workspace, edits []albumEdit) ([]ScanChange, *PublishError) {
	var changes []ScanChange
	at := map[string]int{}
	for _, e := range edits {
		i, ok := at[e.album.Path]
		if !ok {
			current, _ := w.groupFile(e.album.Path)
			i, at[e.album.Path] = len(changes), len(changes)
			changes = append(changes, ScanChange{Path: e.album.Path, Before: current, After: current})
		}
		content, err := setTopLevelList(changes[i].After, e.key, e.value)
		if err != nil {
			return nil, publishErr(http.StatusConflict, "%s: %s", e.album.Path, err)
		}
		changes[i].After = content
	}
	return slices.DeleteFunc(changes, func(ch ScanChange) bool { return bytes.Equal(ch.Before, ch.After) }), nil
}
