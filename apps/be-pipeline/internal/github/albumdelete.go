package github

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// albumsKey is a photo file's list of the albums it's in, by ID.
const albumsKey = "albums"

// DeleteAlbumResult says where deleting an album was saved: in the pending
// changes, for the next Commit.
type DeleteAlbumResult struct {
	pendingSave
	// Photos is how many photo files had the album taken out of their
	// "albums".
	Photos int `json:"photos"`
	// Reparented is how many albums inside it moved up to its parent.
	Reparented int `json:"reparented"`
}

// DeleteAlbum deletes the album's file in the pending changes, takes it out
// of every photo file that lists it, and moves the albums directly inside it
// up to its own parent (or the top level), all as one save. Its photo order,
// covers, layout and spotlight spots go with its file. Nothing is saved when
// it isn't an album or a photo file can't be read.
func (c *Client) DeleteAlbum(ctx context.Context, gh settings.GitHub, id string) (DeleteAlbumResult, error) {
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return DeleteAlbumResult{}, perr
	}
	albums := scan.w.groups()[Albums.Folder]
	album, perr := readableAlbum(albums, strings.TrimSpace(id))
	if perr != nil {
		return DeleteAlbumResult{}, perr
	}
	if perr := allReadable(scan, "the album wasn't deleted"); perr != nil {
		return DeleteAlbumResult{}, perr
	}
	current, _ := scan.w.groupFile(album.Path)
	children, perr := childAlbumChanges(scan.w, albums, album)
	if perr != nil {
		return DeleteAlbumResult{}, perr
	}
	photos, perr := photosLeavingAlbum(scan, album.ID, func(photoInfo) bool { return true })
	if perr != nil {
		return DeleteAlbumResult{}, perr
	}
	gone := ScanChange{Path: album.Path, Before: current}
	saved, perr := c.saveFiles(scan.w, slices.Concat([]ScanChange{gone}, children, photos))
	if perr != nil {
		return DeleteAlbumResult{}, perr
	}
	return DeleteAlbumResult{pendingSave: saved, Photos: len(photos), Reparented: len(children)}, nil
}

// childAlbumChanges is each readable album directly inside album with
// album's own parent as its new "parent".
func childAlbumChanges(w *workspace, albums []Group, album Group) ([]ScanChange, *PublishError) {
	var changes []ScanChange
	for _, child := range albums {
		if child.Parent != album.ID || child.ID == album.ID || child.Error != "" {
			continue
		}
		current, _ := w.groupFile(child.Path)
		content, err := setTopLevel(current, parentKey, parentValue(album.Parent))
		if err != nil {
			return nil, publishErr(http.StatusConflict, "%s: %s, so the album wasn't deleted.", child.Path, err)
		}
		changes = append(changes, ScanChange{Path: child.Path, Before: current, After: content})
	}
	return changes, nil
}

// photoInfo is a photo file's ID and the albums it lists.
type photoInfo struct {
	file   photoFile
	id     int
	albums []string
}

// readPhotoInfo reads f's "id" (0 when it has none) and "albums".
func readPhotoInfo(f photoFile) photoInfo {
	var data struct {
		ID     int      `json:"id"`
		Albums []string `json:"albums"`
	}
	_ = json.Unmarshal(f.content, &data)
	return photoInfo{file: f, id: data.ID, albums: data.Albums}
}

// photosLeavingAlbum is each readable photo file in scan that lists album
// and that pick chooses, with album taken out of its "albums".
func photosLeavingAlbum(scan baseURLScan, album string, pick func(photoInfo) bool) ([]ScanChange, *PublishError) {
	var changes []ScanChange
	for _, f := range scan.files {
		p := readPhotoInfo(f)
		if f.err != "" || !slices.Contains(p.albums, album) || !pick(p) {
			continue
		}
		change, perr := withoutAlbum(p, album)
		if perr != nil {
			return nil, perr
		}
		changes = append(changes, change)
	}
	return changes, nil
}

// withoutAlbum is p's file with album taken out of its "albums".
func withoutAlbum(p photoInfo, album string) (ScanChange, *PublishError) {
	kept := slices.DeleteFunc(slices.Clone(p.albums), func(id string) bool { return id == album })
	value, _ := json.MarshalIndent(append([]string{}, kept...), "  ", "  ")
	after, err := setTopLevelList(p.file.content, albumsKey, value)
	if err != nil {
		return ScanChange{}, publishErr(http.StatusConflict, "%s: %s, so nothing was changed.", p.file.path, err)
	}
	return ScanChange{Path: p.file.path, Before: p.file.content, After: after}, nil
}
