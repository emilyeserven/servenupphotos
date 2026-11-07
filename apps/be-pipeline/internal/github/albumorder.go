package github

import (
	"bytes"
	"cmp"
	"context"
	"encoding/json"
	"maps"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// The album file fields that hold its place among the albums, the
// portfolio's spots that show its photos and the order each puts them in,
// and its photos' order.
const (
	orderKey                = "order"
	spotlightZonesKey       = "spotlightZones"
	spotlightOrientationKey = "spotlightOrientation"
	// spotlightUpdatedKey holds the day each spot was last given to the album.
	spotlightUpdatedKey = "spotlightUpdated"
	photoOrderKey       = "photoOrder"
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

// The ways a spot can order the photos of its album: Screen puts portrait
// photos first on a phone held upright and landscape photos first elsewhere,
// and None keeps the album's order everywhere. A spot that names neither
// matches the screen.
const (
	OrientationScreen = "screen"
	OrientationNone   = "none"
)

// SetSpotlightAlbum makes album the one whose photos the portfolio's spot
// zone shows, adding zone to its file's "spotlightZones" and taking it out of
// every other album's, in the pending changes. The album also gets today's
// date for zone in its "spotlightUpdated", which the Dashboard shows. An empty
// album leaves the spot without one. The spot's orientation, OrientationScreen
// or OrientationNone, is saved in the album's "spotlightOrientation"; an empty
// one keeps the spot's current one, moving it along with the spot.
func (c *Client) SetSpotlightAlbum(ctx context.Context, gh settings.GitHub, zone, album, orientation string) (AlbumsResult, error) {
	zone, album = strings.TrimSpace(zone), strings.TrimSpace(album)
	if perr := checkSpot(zone, orientation); perr != nil {
		return AlbumsResult{}, perr
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
	orientation = cmp.Or(orientation, zoneOrientation(albums, zone))
	var edits []albumEdit
	for _, a := range albums {
		edits = append(edits, zoneEdits(a, zone, a.ID == album, orientation, c.now())...)
	}
	return c.saveAlbumEdits(w, edits)
}

// appendDateEdit adds the edit that records now as the day zone was given to
// album, when in says it was; edits is returned as it was otherwise.
func appendDateEdit(edits []albumEdit, album Group, zone string, in bool, now time.Time) []albumEdit {
	if !in {
		return edits
	}
	dates := maps.Clone(album.SpotlightUpdated)
	if dates == nil {
		dates = map[string]string{}
	}
	dates[zone] = now.Format(time.DateOnly)
	value, _ := json.Marshal(dates)
	return append(edits, albumEdit{album: album, key: spotlightUpdatedKey, value: value})
}

// checkSpot fails when zone isn't a spot's ID or orientation isn't one of
// the ways a spot orders its photos.
func checkSpot(zone, orientation string) *PublishError {
	if !groupIDPattern.MatchString(zone) {
		return publishErr(http.StatusBadRequest, "%q isn't a spotlight spot.", zone)
	}
	if !slices.Contains([]string{"", OrientationScreen, OrientationNone}, orientation) {
		return publishErr(http.StatusBadRequest, "%q isn't a way to order a spot's photos.", orientation)
	}
	return nil
}

// zoneOrientation is the orientation saved for zone by the album that shows
// it now; empty when none does or it has none saved.
func zoneOrientation(albums []Group, zone string) string {
	for _, a := range albums {
		if a.Error == "" && slices.Contains(a.SpotlightZones, zone) {
			return a.SpotlightOrientation[zone]
		}
	}
	return ""
}

// zoneEdits are the edits that put album in zone with orientation, dated
// now, or take it and its orientation out, leaving out the ones that change
// nothing. Changing only the orientation keeps the zone's date.
func zoneEdits(album Group, zone string, in bool, orientation string, now time.Time) []albumEdit {
	var edits []albumEdit
	if edit, ok := zoneEdit(album, zone, in); ok {
		edits = append(edits, edit)
		edits = appendDateEdit(edits, album, zone, in, now)
	}
	if !in {
		orientation = ""
	}
	if edit, ok := orientationEdit(album, zone, orientation); ok {
		edits = append(edits, edit)
	}
	return edits
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

// orientationEdit is the edit that saves orientation for zone in album's
// "spotlightOrientation", or takes zone out of it when orientation is empty,
// and false when it's already that way or its file couldn't be read.
func orientationEdit(album Group, zone, orientation string) (albumEdit, bool) {
	next := maps.Clone(album.SpotlightOrientation)
	if next == nil {
		next = map[string]string{}
	}
	delete(next, zone)
	if orientation != "" {
		next[zone] = orientation
	}
	if album.Error != "" || maps.Equal(next, album.SpotlightOrientation) {
		return albumEdit{}, false
	}
	value, _ := json.Marshal(next)
	return albumEdit{album: album, key: spotlightOrientationKey, value: value}, true
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
