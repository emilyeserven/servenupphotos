package github

import (
	"context"
	"net/http"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// maxViewerLikes is the most photos one viewer's list can like.
const maxViewerLikes = 10000

// ViewerLikes is a viewer likes file: one person and the photos they liked on the
// portfolio's My Likes page and sent with "Send to photographer". Importing a
// person's list again replaces it, so each person's likes count once.
type ViewerLikes struct {
	ID string `json:"id"`
	// Name is who sent the list, as the Viewer Likes page shows it.
	Name string `json:"name"`
	// Photos are the IDs of the photos they liked, lowest first, each once.
	Photos []int `json:"photos"`
	// ImportedAt is when the list was last imported, as a UTC time such as
	// "2026-11-03T03:32:11Z".
	ImportedAt string `json:"importedAt"`
}

// SaveViewerLikes saves viewer as <folder>/likes/<id>.json, replacing the list
// already there for that person, in the pending changes, stamped with the
// time it was imported.
func (c *Client) SaveViewerLikes(ctx context.Context, gh settings.GitHub, viewer ViewerLikes) (EntryResult, error) {
	viewer, perr := validViewerLikes(viewer)
	if perr != nil {
		return EntryResult{}, perr
	}
	viewer.ImportedAt = addedTime(c.now())
	return c.saveEntry(ctx, gh, ViewerLikesKind, viewer.ID, viewer, func([]Entry) *PublishError { return nil })
}

// DeleteViewerLikes removes the viewer likes file named id in the pending changes.
func (c *Client) DeleteViewerLikes(ctx context.Context, gh settings.GitHub, id string) (EntryResult, error) {
	return c.deleteEntry(ctx, gh, ViewerLikesKind, id, func([]Entry) *PublishError { return nil })
}

// validViewerLikes checks f and returns it as it will be saved: its name trimmed
// and its photos sorted, each once.
func validViewerLikes(f ViewerLikes) (ViewerLikes, *PublishError) {
	out := ViewerLikes{ID: strings.TrimSpace(f.ID), Name: strings.TrimSpace(f.Name), Photos: likedPhotos(f.Photos)}
	if perr := validEntryID(ViewerLikesKind.Name, out.ID); perr != nil {
		return out, perr
	}
	if out.Name == "" {
		return out, publishErr(http.StatusBadRequest, "Give the person a name.")
	}
	if utf8.RuneCountInString(out.Name) > maxEntryTextLength {
		return out, publishErr(http.StatusBadRequest, "Keep the name to %d characters.", maxEntryTextLength)
	}
	return out, validLikedPhotos(out.Photos)
}

// likedPhotos is ids sorted, each once.
func likedPhotos(ids []int) []int {
	out := slices.Compact(slices.Sorted(slices.Values(ids)))
	if out == nil {
		return []int{}
	}
	return out
}

// validLikedPhotos fails when ids, sorted, has a photo ID below 1 or more
// photos than a list can have.
func validLikedPhotos(ids []int) *PublishError {
	if len(ids) > 0 && ids[0] < 1 {
		return publishErr(http.StatusBadRequest, "Photo IDs are whole numbers from 1, such as 12.")
	}
	if len(ids) > maxViewerLikes {
		return publishErr(http.StatusBadRequest, "Keep the list to %d photos.", maxViewerLikes)
	}
	return nil
}
