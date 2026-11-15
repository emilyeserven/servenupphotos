package github

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// maxPhotoSetPhotos is the most photos one Photo Set can hold.
const maxPhotoSetPhotos = 500

// PhotoSet is a Photo Set file: photos that the portfolio's map always shows
// as one marker, however far in or out it's zoomed, rather than splitting
// them apart or grouping them with the photos around them.
type PhotoSet struct {
	// ID is made from the name when the set is made, and kept after that.
	ID string `json:"id"`
	// Name is how the pipeline lists it and the map's popup titles it, such
	// as "Gyeongbokgung at night".
	Name string `json:"name"`
	// Photos are the IDs of its photos, in the order the popup shows them;
	// the first is the one on its marker.
	Photos []int `json:"photos"`
}

// SavePhotoSet saves set as <folder>/sets/<id>.json, new or replacing the one
// there, in the pending changes. It fails when one of its photos is already
// in another set, as a photo can only be kept together with one group.
func (c *Client) SavePhotoSet(ctx context.Context, gh settings.GitHub, set PhotoSet) (EntryResult, error) {
	set, perr := validPhotoSet(set)
	if perr != nil {
		return EntryResult{}, perr
	}
	return c.saveEntry(ctx, gh, PhotoSets, set.ID, set, func(others []Entry) *PublishError {
		return photoSetClash(set, parsePhotoSets(others))
	})
}

// DeletePhotoSet removes the Photo Set named id in the pending changes, so
// the map shows its photos on their own again. The photos stay as they are.
func (c *Client) DeletePhotoSet(ctx context.Context, gh settings.GitHub, id string) (EntryResult, error) {
	return c.deleteEntry(ctx, gh, PhotoSets, id, func([]Entry) *PublishError { return nil })
}

// parsePhotoSets is the Photo Set files in entries that can be read.
func parsePhotoSets(entries []Entry) []PhotoSet {
	var out []PhotoSet
	for _, e := range entries {
		var s PhotoSet
		if json.Unmarshal(e.Data, &s) == nil && s.ID != "" {
			out = append(out, s)
		}
	}
	return out
}

// photoSetClash is an error naming the first of set's photos that another
// set already has, or nil when none do.
func photoSetClash(set PhotoSet, others []PhotoSet) *PublishError {
	for _, o := range others {
		if o.ID == set.ID {
			continue
		}
		for _, id := range o.Photos {
			if containsInt(set.Photos, id) {
				return publishErr(http.StatusConflict, "Photo %d is already in the set %q. Take it out of that set first.", id, o.Name)
			}
		}
	}
	return nil
}

// containsInt reports whether ids has id.
func containsInt(ids []int, id int) bool {
	for _, v := range ids {
		if v == id {
			return true
		}
	}
	return false
}

// validPhotoSet checks s and returns it as it will be saved: its name
// trimmed and each photo listed once.
func validPhotoSet(s PhotoSet) (PhotoSet, *PublishError) {
	out := PhotoSet{ID: strings.TrimSpace(s.ID), Name: strings.TrimSpace(s.Name), Photos: []int{}}
	if perr := validEntryID(PhotoSets.Name, out.ID); perr != nil {
		return out, perr
	}
	if out.Name == "" || utf8.RuneCountInString(out.Name) > maxEntryTextLength {
		return out, publishErr(http.StatusBadRequest, "Name the set, in up to %d characters.", maxEntryTextLength)
	}
	for _, id := range s.Photos {
		if id <= 0 {
			return out, publishErr(http.StatusBadRequest, "Photo IDs are whole numbers above 0.")
		}
		if !containsInt(out.Photos, id) {
			out.Photos = append(out.Photos, id)
		}
	}
	if len(out.Photos) > maxPhotoSetPhotos {
		return out, publishErr(http.StatusBadRequest, "A set holds up to %d photos.", maxPhotoSetPhotos)
	}
	return out, nil
}
