package github

import (
	"context"
	"net/http"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// maxFanLikes is the most photos one fan's list can like.
const maxFanLikes = 10000

// FanLikes is a fan likes file: one person and the photos they liked on the
// portfolio's My Likes page and sent with "Send to photographer". Importing a
// person's list again replaces it, so each person's likes count once.
type FanLikes struct {
	ID string `json:"id"`
	// Name is who sent the list, as the Fan Likes page shows it.
	Name string `json:"name"`
	// Photos are the IDs of the photos they liked, lowest first, each once.
	Photos []int `json:"photos"`
	// ImportedAt is when the list was last imported, as a UTC time such as
	// "2026-11-03T03:32:11Z".
	ImportedAt string `json:"importedAt"`
}

// SaveFanLikes saves fan as <folder>/likes/<id>.json, replacing the list
// already there for that person, in the pending changes, stamped with the
// time it was imported.
func (c *Client) SaveFanLikes(ctx context.Context, gh settings.GitHub, fan FanLikes) (EntryResult, error) {
	fan, perr := validFanLikes(fan)
	if perr != nil {
		return EntryResult{}, perr
	}
	fan.ImportedAt = addedTime(c.now())
	return c.saveEntry(ctx, gh, FanLikesKind, fan.ID, fan, func([]Entry) *PublishError { return nil })
}

// DeleteFanLikes removes the fan likes file named id in the pending changes.
func (c *Client) DeleteFanLikes(ctx context.Context, gh settings.GitHub, id string) (EntryResult, error) {
	return c.deleteEntry(ctx, gh, FanLikesKind, id, func([]Entry) *PublishError { return nil })
}

// validFanLikes checks f and returns it as it will be saved: its name trimmed
// and its photos sorted, each once.
func validFanLikes(f FanLikes) (FanLikes, *PublishError) {
	out := FanLikes{ID: strings.TrimSpace(f.ID), Name: strings.TrimSpace(f.Name), Photos: likedPhotos(f.Photos)}
	if perr := validEntryID(FanLikesKind.Name, out.ID); perr != nil {
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
	if len(ids) > maxFanLikes {
		return publishErr(http.StatusBadRequest, "Keep the list to %d photos.", maxFanLikes)
	}
	return nil
}
