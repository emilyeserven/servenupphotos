package github

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// unselectedKey is a photo file's Unselected Photos mark, and winnersKey the
// IDs of the photos chosen over it inside that mark.
const (
	unselectedKey = "unselected"
	winnersKey    = "winners"
)

// DeletedPhoto says what deleting a photo saved, in the pending changes for
// the next Commit, and which images it named, so they can be deleted from R2.
type DeletedPhoto struct {
	pendingSave
	RemovedFile
	// OriginalKey is the R2 key of the photo's unedited original, or "" when
	// it has none.
	OriginalKey string `json:"originalKey,omitempty"`
}

// DeletePhoto deletes the photo JSON file at file, which may be new in the
// photo data pull request or already in the portfolio, and takes the photo out
// of everything that points at it, all as one save in the pending changes:
// albums' photo order, covers and layout, other photos' Unselected Photos
// winners, the bio, viewer likes, photo book pages and trip lines. Its images
// in R2 are left for the caller to delete. Nothing is saved when the file
// can't be read or one of the files pointing at it can't be changed.
func (c *Client) DeletePhoto(ctx context.Context, gh settings.GitHub, file string) (DeletedPhoto, error) {
	if perr := setUp(gh); perr != nil {
		return DeletedPhoto{}, perr
	}
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return DeletedPhoto{}, perr
	}
	content, perr := photoToDelete(scan, file)
	if perr != nil {
		return DeletedPhoto{}, perr
	}
	refs, perr := photoReferences(scan, file, content)
	if perr != nil {
		return DeletedPhoto{}, perr
	}
	gone := ScanChange{Path: file, Before: content}
	saved, perr := c.saveFiles(scan.w, slices.Concat([]ScanChange{gone}, refs))
	if perr != nil {
		return DeletedPhoto{}, perr
	}
	removed := RemovedFile{Path: file, Before: json.RawMessage(content)}
	removed.PhotoName, removed.ImageURL, removed.ImageKey = photoRef(file, content)
	return DeletedPhoto{pendingSave: saved, RemovedFile: removed, OriginalKey: uneditedOriginalKey(content)}, nil
}

// photoToDelete is the content of the photo file at file in scan, or why it
// can't be deleted.
func photoToDelete(scan baseURLScan, file string) ([]byte, *PublishError) {
	if !isPhotoData(scan.folder, file) {
		return nil, publishErr(http.StatusBadRequest, "Only photo JSON files in %s can be deleted.", scan.folder)
	}
	i := slices.IndexFunc(scan.files, func(f photoFile) bool { return f.path == file })
	if i == -1 {
		return nil, publishErr(http.StatusNotFound, "%s isn't there anymore. Refresh to see what is.", file)
	}
	if f := scan.files[i]; f.err != "" {
		return nil, publishErr(http.StatusConflict, "%s: %s, so it wasn't deleted.", file, f.err)
	}
	return scan.files[i].content, nil
}

// photoReferences is every other file in scan's workspace that points at the
// photo file at file, by its ID or path, with the photo taken out.
func photoReferences(scan baseURLScan, file string, content []byte) ([]ScanChange, *PublishError) {
	id, hasID := photoID(content)
	paths := entriesWithoutPhotoFile(scan.w, file)
	if !hasID {
		return paths, nil
	}
	albums, perr := albumsWithoutPhoto(scan.w, id)
	if perr != nil {
		return nil, perr
	}
	winners, perr := winnersWithoutPhoto(scan, file, id)
	if perr != nil {
		return nil, perr
	}
	return slices.Concat(albums, winners, paths, entriesWithoutPhotoID(scan.w, id)), nil
}

// albumsWithoutPhoto is each album file the next Commit will have with the
// photo with id taken out of its photo order, covers and layout.
func albumsWithoutPhoto(w *workspace, id int) ([]ScanChange, *PublishError) {
	gone := map[int]bool{id: true}
	var edits []albumEdit
	for _, album := range w.groups()[Albums.Folder] {
		if _, ok := w.file(album.Path); !ok || album.Error != "" {
			continue
		}
		edits = append(edits, albumWithout(album, gone)...)
	}
	return albumChanges(w, edits)
}

// winnersWithoutPhoto is each other readable photo file in scan whose
// Unselected Photos mark names the photo with id as a winner, with it taken
// out of the winners. Every other byte of the file stays as it was.
func winnersWithoutPhoto(scan baseURLScan, file string, id int) ([]ScanChange, *PublishError) {
	var changes []ScanChange
	for _, f := range scan.files {
		if f.path == file || f.err != "" {
			continue
		}
		after, changed, err := withoutWinner(f.content, id)
		if err != nil {
			return nil, publishErr(http.StatusConflict, "%s: %s, so the photo wasn't deleted.", f.path, err)
		}
		if changed {
			changes = append(changes, ScanChange{Path: f.path, Before: f.content, After: after})
		}
	}
	return changes, nil
}

// withoutWinner is content with id taken out of its "unselected" mark's
// "winners", and whether it was there.
func withoutWinner(content []byte, id int) ([]byte, bool, error) {
	var photo struct {
		Unselected json.RawMessage `json:"unselected"`
	}
	_ = json.Unmarshal(content, &photo)
	var mark struct {
		Winners []int `json:"winners"`
	}
	if json.Unmarshal(photo.Unselected, &mark) != nil || !slices.Contains(mark.Winners, id) {
		return content, false, nil
	}
	winners, _ := json.Marshal(withoutPhotos(mark.Winners, map[int]bool{id: true}))
	unselected, err := setTopLevelList(photo.Unselected, winnersKey, winners)
	if err != nil {
		return nil, false, err
	}
	after, err := setTopLevelList(content, unselectedKey, unselected)
	return after, err == nil, err
}

// uneditedOriginalKey is the R2 key of content's unedited original ("original" →
// "images" → "key"), or "" when it has none.
func uneditedOriginalKey(content []byte) string {
	var photo struct {
		Original *struct {
			Images struct {
				Key string `json:"key"`
			} `json:"images"`
		} `json:"original"`
	}
	if json.Unmarshal(content, &photo) != nil || photo.Original == nil {
		return ""
	}
	return strings.TrimSpace(photo.Original.Images.Key)
}
