package github

import (
	"context"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// NotStoredPost is a Not Stored post file: a day something went up on
// Instagram whose photo isn't in the portfolio, so the Instagram calendar and
// the Social Feed preview keep its place in the feed. One file per day, named
// by the day.
type NotStoredPost struct {
	// ID is the day, such as "2026-11-10".
	ID string `json:"id"`
	// Day is the day it went up on Instagram, the same as ID.
	Day string `json:"day"`
	// Note is a few words on what was posted, such as "Story repost"; "" for
	// none.
	Note string `json:"note"`
}

// SaveNotStoredPost saves post as <folder>/notstored/<day>.json, new or
// replacing the one there, in the pending changes.
func (c *Client) SaveNotStoredPost(ctx context.Context, gh settings.GitHub, post NotStoredPost) (EntryResult, error) {
	post, perr := validNotStoredPost(post)
	if perr != nil {
		return EntryResult{}, perr
	}
	return c.saveEntry(ctx, gh, NotStoredKind, post.ID, post, func([]Entry) *PublishError { return nil })
}

// DeleteNotStoredPost removes the Not Stored post of day in the pending
// changes, which frees that day on the Instagram calendar.
func (c *Client) DeleteNotStoredPost(ctx context.Context, gh settings.GitHub, day string) (EntryResult, error) {
	return c.deleteEntry(ctx, gh, NotStoredKind, day, func([]Entry) *PublishError { return nil })
}

// validNotStoredPost checks p and returns it as it will be saved: its day
// taken from its ID and its note trimmed. It fails when the ID isn't a day.
func validNotStoredPost(p NotStoredPost) (NotStoredPost, *PublishError) {
	out := NotStoredPost{ID: strings.TrimSpace(p.ID), Note: strings.TrimSpace(p.Note)}
	out.Day = out.ID
	if _, err := time.Parse(time.DateOnly, out.ID); err != nil {
		return out, publishErr(http.StatusBadRequest, "Name a Not Stored post by its day, such as 2026-11-10.")
	}
	if utf8.RuneCountInString(out.Note) > maxEntryTextLength {
		return out, publishErr(http.StatusBadRequest, "Keep the note to %d characters.", maxEntryTextLength)
	}
	return out, nil
}
