package github

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"sort"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// RemovedPhotosResult says where taking photos out of an album was saved: in
// the pending changes, for the next Commit.
type RemovedPhotosResult struct {
	pendingSave
	// Photos is how many photo files had the album taken out of their
	// "albums".
	Photos int `json:"photos"`
}

// RemoveAlbumPhotos takes the album out of the "albums" of the photos with
// photoIDs, and takes those photos out of its photo order, covers and layout
// (dropping a row left with neither photos nor text), all as one save in the
// pending changes. Each photo keeps its other albums. It fails when an ID
// isn't a photo's, or the photo isn't in the album itself (only in an album
// inside it).
func (c *Client) RemoveAlbumPhotos(ctx context.Context, gh settings.GitHub, id string, photoIDs []int) (RemovedPhotosResult, error) {
	if perr := checkRemovedPhotos(photoIDs); perr != nil {
		return RemovedPhotosResult{}, perr
	}
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return RemovedPhotosResult{}, perr
	}
	album, perr := readableAlbum(scan.w.groups()[Albums.Folder], strings.TrimSpace(id))
	if perr != nil {
		return RemovedPhotosResult{}, perr
	}
	gone := map[int]bool{}
	for _, photoID := range photoIDs {
		gone[photoID] = true
	}
	if perr := checkInAlbum(scan, album, gone); perr != nil {
		return RemovedPhotosResult{}, perr
	}
	photos, perr := photosLeavingAlbum(scan, album.ID, func(p photoInfo) bool { return gone[p.id] })
	if perr != nil {
		return RemovedPhotosResult{}, perr
	}
	albumFile, perr := albumChanges(scan.w, albumWithout(album, gone))
	if perr != nil {
		return RemovedPhotosResult{}, perr
	}
	saved, perr := c.saveFiles(scan.w, slices.Concat(photos, albumFile))
	if perr != nil {
		return RemovedPhotosResult{}, perr
	}
	return RemovedPhotosResult{pendingSave: saved, Photos: len(photos)}, nil
}

// checkRemovedPhotos fails when there are no photos to remove, or an ID isn't
// a photo ID or is listed twice.
func checkRemovedPhotos(photoIDs []int) *PublishError {
	if len(photoIDs) == 0 {
		return publishErr(http.StatusBadRequest, "Choose the photos to remove from the album.")
	}
	return checkPhotoIDs(photoIDs, "the photos to remove")
}

// checkInAlbum fails when a photo in gone, by ID, isn't a readable photo
// file in scan that lists album.
func checkInAlbum(scan baseURLScan, album Group, gone map[int]bool) *PublishError {
	found := map[int]bool{}
	for _, f := range scan.files {
		p := readPhotoInfo(f)
		if gone[p.id] && f.err == "" {
			found[p.id] = slices.Contains(p.albums, album.ID)
		}
	}
	var missing []int
	for photoID := range gone {
		in, ok := found[photoID]
		if !ok {
			missing = append(missing, photoID)
		} else if !in {
			return publishErr(http.StatusConflict, "Photo %d isn't in %s itself, so it can't be removed from it. It may be in an album inside it.", photoID, album.Name)
		}
	}
	if len(missing) > 0 {
		sort.Ints(missing)
		return publishErr(http.StatusNotFound, "There's no photo with the ID %d. Refresh to see what there is.", missing[0])
	}
	return nil
}

// albumWithout is the edits that take the photos in gone out of album's
// photo order, covers and layout, leaving out the ones that don't change.
func albumWithout(album Group, gone map[int]bool) []albumEdit {
	var edits []albumEdit
	for key, ids := range map[string][]int{photoOrderKey: album.PhotoOrder, coversKey: album.Covers} {
		if kept := withoutPhotos(ids, gone); len(kept) != len(ids) {
			value, _ := json.Marshal(kept)
			edits = append(edits, albumEdit{album: album, key: key, value: value})
		}
	}
	if rows, changed := layoutWithout(album.Layout, gone); changed {
		value, _ := json.Marshal(rows)
		edits = append(edits, albumEdit{album: album, key: layoutKey, value: value})
	}
	// Map order is random; keep the file's edits in one order.
	sort.Slice(edits, func(i, j int) bool { return edits[i].key < edits[j].key })
	return edits
}

// withoutPhotos is ids without the ones in gone, never nil.
func withoutPhotos(ids []int, gone map[int]bool) []int {
	return slices.DeleteFunc(append([]int{}, ids...), func(id int) bool { return gone[id] })
}

// layoutWithout is rows with the photos in gone taken out, dropping a row
// left with neither photos nor text, and whether anything changed.
func layoutWithout(rows []AlbumRow, gone map[int]bool) ([]AlbumRow, bool) {
	out := make([]AlbumRow, 0, len(rows))
	changed := false
	for _, row := range rows {
		photos := withoutPhotos(row.Photos, gone)
		changed = changed || len(photos) != len(row.Photos)
		if len(photos) > 0 || row.TextAbove != "" || row.TextBelow != "" {
			out = append(out, AlbumRow{TextAbove: row.TextAbove, Photos: photos, TextBelow: row.TextBelow})
		}
	}
	return out, changed
}
