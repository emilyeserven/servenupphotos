package github

import (
	"bytes"
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// BulkPlacePick is the photos Bulk Places picked to find places for together.
type BulkPlacePick struct {
	bulkPick
	// Unplaced is how many photo files have no places.
	Unplaced int `json:"unplaced"`
}

// PickBulkPlacePhotos picks up to count related photos (1 to 50, 5 when
// unset) without places, as PickBulkTagPhotos picks photos without tags: the
// first by path, then the ones that share its city or country, genres and
// date. It only reads.
func (c *Client) PickBulkPlacePhotos(ctx context.Context, gh settings.GitHub, skip []string, count int) (BulkPlacePick, error) {
	pick, unplaced, err := c.pickBulk(ctx, gh, skip, count,
		func(p bulkPhoto) bool { return len(p.places) == 0 },
		"There are no more photos without places to pick from. Start over to pick from every one again.")
	return BulkPlacePick{bulkPick: pick, Unplaced: unplaced}, err
}

// BulkPlacesPhoto is the places to give one photo file, and the city, state
// and country to write in by hand where it shows none.
type BulkPlacesPhoto struct {
	Path string `json:"path"`
	// Places replace the photo's places, the most specific first.
	Places []PhotoPlace `json:"places"`
	// CustomCity, CustomState and CustomCountry are saved as the photo's
	// custom ones when set; "" leaves the photo's own.
	CustomCity    string `json:"customCity,omitempty"`
	CustomState   string `json:"customState,omitempty"`
	CustomCountry string `json:"customCountry,omitempty"`
}

// BulkPlaces is what Bulk Places saves, as the review left it: the new
// places to make, and the places to give each photo.
type BulkPlaces struct {
	NewPlaces []Place           `json:"newPlaces"`
	Photos    []BulkPlacesPhoto `json:"photos"`
}

// BulkPlacesResult says where Bulk Places' changes were saved: in the
// pending changes, for the next Commit.
type BulkPlacesResult struct {
	pendingSave
	// NewPlaces is how many places were made.
	NewPlaces int `json:"newPlaces"`
	// Photos is how many photo files changed; the others already had them.
	Photos int `json:"photos"`
}

// photoRelations are the words a photo can be joined to a place with, or ""
// for none.
var photoRelations = append([]string{""}, slices.DeleteFunc(slices.Clone(placeRelations), func(r string) bool { return r == "," })...)

// ApplyBulkPlaces makes the new places, as SavePlace checks them, and gives
// each photo its places, all as one save in the pending changes. Nothing is
// saved when a place can't be made or a photo can't be read.
func (c *Client) ApplyBulkPlaces(ctx context.Context, gh settings.GitHub, bulk BulkPlaces) (BulkPlacesResult, error) {
	if len(bulk.Photos) == 0 || len(bulk.Photos) > maxBulkTagPhotos {
		return BulkPlacesResult{}, publishErr(http.StatusBadRequest, "Give places to 1 to %d photos at a time.", maxBulkTagPhotos)
	}
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return BulkPlacesResult{}, perr
	}
	entries := scan.w.entries(Places)
	placeChanges, entries, perr := newPlaceFiles(scan.w, entries, bulk.NewPlaces)
	if perr != nil {
		return BulkPlacesResult{}, perr
	}
	photoChanges, perr := placedPhotos(scan, placeNames(entries), bulk.Photos)
	if perr != nil {
		return BulkPlacesResult{}, perr
	}
	if len(placeChanges)+len(photoChanges) == 0 {
		return BulkPlacesResult{}, publishErr(http.StatusConflict, "Those photos already have those places, so there's nothing to change.")
	}
	saved, perr := c.saveFiles(scan.w, slices.Concat(placeChanges, photoChanges))
	if perr != nil {
		return BulkPlacesResult{}, perr
	}
	return BulkPlacesResult{pendingSave: saved, NewPlaces: len(placeChanges), Photos: len(photoChanges)}, nil
}

// newPlaceFiles is a new place file for each of places, checked as SavePlace
// checks it against entries, and entries with them added, so a later one can
// be in an earlier one.
func newPlaceFiles(w *workspace, entries []Entry, places []Place) ([]ScanChange, []Entry, *PublishError) {
	var changes []ScanChange
	for _, place := range places {
		p, perr := validPlace(place)
		if perr == nil {
			perr = placeNameTaken(entries, p)
		}
		if perr == nil {
			perr = badParent(entries, p)
		}
		if perr != nil {
			return nil, nil, publishErr(perr.Status, "%s: %s Nothing was changed.", place.Name, perr.Message)
		}
		file := w.root + "/" + Places.Folder + "/" + p.ID + ".json"
		if perr := w.ensureAbsent(file); perr != nil {
			return nil, nil, perr
		}
		b, _ := json.MarshalIndent(p, "", "  ")
		b = append(b, '\n')
		changes = append(changes, ScanChange{Path: file, After: b})
		entries = append(entries, Entry{Path: file, Data: b})
	}
	return changes, entries, nil
}

// placeNames is each readable place in entries' name, by ID.
func placeNames(entries []Entry) map[string]string {
	names := map[string]string{}
	for _, e := range entries {
		var p Place
		if json.Unmarshal(e.Data, &p) == nil && p.ID != "" {
			names[p.ID] = cmp.Or(p.Name, p.ID)
		}
	}
	return names
}

// placedPhotos is each of photos with its places given, leaving out the ones
// that already have them. Each place must be one of names'.
func placedPhotos(scan baseURLScan, names map[string]string, photos []BulkPlacesPhoto) ([]ScanChange, *PublishError) {
	var changes []ScanChange
	seen := map[string]bool{}
	for _, p := range photos {
		if seen[p.Path] {
			return nil, publishErr(http.StatusBadRequest, "%s is listed more than once.", p.Path)
		}
		seen[p.Path] = true
		change, perr := placedPhoto(scan, names, p)
		if perr != nil {
			return nil, perr
		}
		if change != nil {
			changes = append(changes, *change)
		}
	}
	return changes, nil
}

// badPhotoPlaces fails unless places has one or two places, each one of
// names' with a relation a photo can have.
func badPhotoPlaces(names map[string]string, places []PhotoPlace) *PublishError {
	if len(places) == 0 || len(places) > 2 {
		return publishErr(http.StatusBadRequest, "Give each photo one or two places.")
	}
	for _, place := range places {
		if _, ok := names[place.ID]; !ok {
			return publishErr(http.StatusBadRequest, "%q isn't a place, so nothing was changed.", place.ID)
		}
		if !slices.Contains(photoRelations, place.Relation) {
			return publishErr(http.StatusBadRequest, "A photo's relation to a place is one of %s, or none.", strings.Join(photoRelations[1:], ", "))
		}
	}
	return nil
}

// placedPhoto is the photo file at p.Path with p's places, place name and
// custom city, state and country, or nil when it already has them.
func placedPhoto(scan baseURLScan, names map[string]string, p BulkPlacesPhoto) (*ScanChange, *PublishError) {
	if perr := badPhotoPlaces(names, p.Places); perr != nil {
		return nil, perr
	}
	photos, perr := picked(scan, []string{p.Path})
	if perr != nil {
		return nil, perr
	}
	before := photos[0].file.content
	after, err := withPlaces(before, names[p.Places[0].ID], p)
	if err != nil {
		return nil, publishErr(http.StatusConflict, "%s: %s, so nothing was changed.", p.Path, err)
	}
	if bytes.Equal(before, after) {
		return nil, nil
	}
	return &ScanChange{Path: p.Path, Before: before, After: after}, nil
}

// withPlaces is content with p's places, placeName as its place name, and
// p's custom city, state and country where they're set; the rest of the file
// is kept byte for byte, and so are the places when they're already p's.
func withPlaces(content []byte, placeName string, p BulkPlacesPhoto) ([]byte, error) {
	var current struct {
		Places []PhotoPlace `json:"places"`
	}
	if err := json.Unmarshal(content, &current); err != nil {
		return nil, errors.New("its places aren't a list of places")
	}
	out := content
	if !slices.Equal(current.Places, p.Places) {
		rows, _ := json.MarshalIndent(p.Places, "  ", "  ")
		var err error
		if out, err = setTopLevelList(content, "places", rows); err != nil {
			return nil, err
		}
	}
	return withTexts(out, [][2]string{{"placeName", placeName}, {"customCity", p.CustomCity}, {"customState", p.CustomState}, {"customCountry", p.CustomCountry}})
}

// withTexts is content with each key set to its text, unless the text is ""
// or the key already has it.
func withTexts(content []byte, texts [][2]string) ([]byte, error) {
	var current map[string]any
	_ = json.Unmarshal(content, &current)
	out := content
	for _, kv := range texts {
		if kv[1] == "" || current[kv[0]] == kv[1] {
			continue
		}
		value, _ := json.Marshal(kv[1])
		var err error
		if out, err = setTopLevel(out, kv[0], value); err != nil {
			return nil, err
		}
	}
	return out, nil
}
