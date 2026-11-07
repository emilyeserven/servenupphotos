package github

import (
	"context"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// storyIDPrefix starts the ID of every day's story file. Stories are kept in
// the trip lines folder, next to the days' lines and the Trips, so they're
// combined into TRIPLINES.json, listed as changes and committed like them; a
// day's line is named by its date and a Trip starts with "trip-", so none of
// the three meet.
const storyIDPrefix = "story-"

// Limits on a day's story.
const (
	// maxStoryPhotos is the most photos one day's story can show.
	maxStoryPhotos = 500
	// maxStoryRow is the most photos side by side in one row, as in an
	// album's layout.
	maxStoryRow = 4
	// maxCaptionLength is the most characters a photo's caption can have.
	maxCaptionLength = 500
	// maxParagraphLength is the most characters a paragraph can have, as an
	// album layout row's text.
	maxParagraphLength = 5000
)

// TripStory is a day's story file: the words around the day's photos on the
// portfolio's Trip page, and which photos share a row. The Trip page of a day
// in a Trip gathers the stories of the Trip's days; a day in no Trip gets a
// page of its own.
type TripStory struct {
	// ID is "story-" and the day, such as "story-2026-09-23", also its file name.
	ID string `json:"id"`
	// Date is the day, such as "2026-09-23". It isn't called "day", so the
	// file is never read as a day's line.
	Date string `json:"date"`
	// Intro is a paragraph (Markdown) before the day's first photo; "" for none.
	Intro string `json:"intro,omitempty"`
	// Photos are the photos the page shows for the day, in order. A photo of
	// the day left out isn't shown.
	Photos []StoryPhoto `json:"photos"`
}

// StoryPhoto is one photo of a day's story, with the words around it.
type StoryPhoto struct {
	// ID is the photo's ID.
	ID int `json:"id"`
	// Caption is shown under the photo; "" for none.
	Caption string `json:"caption,omitempty"`
	// WithNext puts the next photo in the same row as this one, side by side.
	WithNext bool `json:"withNext,omitempty"`
	// After is a paragraph (Markdown) shown after the photo, across the
	// page, which ends its row; "" for none.
	After string `json:"after,omitempty"`
}

// SaveTripStory saves story as <folder>/triplines/story-<day>.json, new or
// replacing the one there, in the pending changes. It fails when a photo
// wasn't taken that day, is listed twice, or a row has too many photos.
func (c *Client) SaveTripStory(ctx context.Context, gh settings.GitHub, story TripStory) (EntryResult, error) {
	story, perr := validTripStory(story)
	if perr != nil {
		return EntryResult{}, perr
	}
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return EntryResult{}, perr
	}
	if perr := checkStoryPhotos(story, w.photoDays()); perr != nil {
		return EntryResult{}, perr
	}
	return c.saveEntry(ctx, gh, TripLines, story.ID, story, func([]Entry) *PublishError { return nil })
}

// DeleteTripStory removes the story file id in the pending changes.
func (c *Client) DeleteTripStory(ctx context.Context, gh settings.GitHub, id string) (EntryResult, error) {
	if !strings.HasPrefix(id, storyIDPrefix) {
		return EntryResult{}, publishErr(http.StatusBadRequest, "That isn't a day's story.")
	}
	return c.deleteEntry(ctx, gh, TripLines, id, func([]Entry) *PublishError { return nil })
}

// validTripStory checks story and returns it trimmed, as it will be saved.
func validTripStory(story TripStory) (TripStory, *PublishError) {
	story.ID = strings.TrimSpace(story.ID)
	story.Date = strings.TrimPrefix(story.ID, storyIDPrefix)
	if !strings.HasPrefix(story.ID, storyIDPrefix) {
		return story, publishErr(http.StatusBadRequest, "Start a story's ID with %q.", storyIDPrefix)
	}
	if _, err := time.Parse(labelDateLayout, story.Date); err != nil {
		return story, publishErr(http.StatusBadRequest, "Give the story's day as a date, such as story-2026-09-23.")
	}
	story.Intro = strings.TrimSpace(story.Intro)
	if utf8.RuneCountInString(story.Intro) > maxParagraphLength {
		return story, publishErr(http.StatusBadRequest, "Keep the first paragraph to %d characters.", maxParagraphLength)
	}
	if story.Photos == nil {
		story.Photos = []StoryPhoto{}
	}
	if len(story.Photos) > maxStoryPhotos {
		return story, publishErr(http.StatusBadRequest, "Keep a day's story to %d photos.", maxStoryPhotos)
	}
	for i := range story.Photos {
		if perr := trimStoryPhoto(&story.Photos[i], i == len(story.Photos)-1); perr != nil {
			return story, perr
		}
	}
	return story, checkStoryRows(story.Photos)
}

// trimStoryPhoto trims p's words in place, and fails when they're too long
// or it both shares a row with the next photo and has a paragraph after it.
// The last photo has no next one to share a row with.
func trimStoryPhoto(p *StoryPhoto, last bool) *PublishError {
	p.Caption = strings.TrimSpace(p.Caption)
	p.After = strings.TrimSpace(p.After)
	p.WithNext = p.WithNext && !last
	if utf8.RuneCountInString(p.Caption) > maxCaptionLength {
		return publishErr(http.StatusBadRequest, "Photo %d: keep its caption to %d characters.", p.ID, maxCaptionLength)
	}
	if utf8.RuneCountInString(p.After) > maxParagraphLength {
		return publishErr(http.StatusBadRequest, "Photo %d: keep the paragraph after it to %d characters.", p.ID, maxParagraphLength)
	}
	if p.WithNext && p.After != "" {
		return publishErr(http.StatusBadRequest, "Photo %d shares a row with the next photo, so it can't have a paragraph between them.", p.ID)
	}
	return nil
}

// checkStoryRows fails when a photo is listed twice or a row has more than
// maxStoryRow photos.
func checkStoryRows(photos []StoryPhoto) *PublishError {
	seen := map[int]bool{}
	row := 0
	for _, p := range photos {
		if seen[p.ID] {
			return publishErr(http.StatusBadRequest, "Photo %d is in the story twice.", p.ID)
		}
		seen[p.ID] = true
		row++
		if row > maxStoryRow {
			return publishErr(http.StatusBadRequest, "Photo %d would make a row of more than %d photos.", p.ID, maxStoryRow)
		}
		if !p.WithNext {
			row = 0
		}
	}
	return nil
}

// checkStoryPhotos fails when one of story's photos wasn't taken on its day.
// days is the day each photo was taken, by ID.
func checkStoryPhotos(story TripStory, days map[int]string) *PublishError {
	for _, p := range story.Photos {
		if day, ok := days[p.ID]; !ok || day != story.Date {
			return publishErr(http.StatusBadRequest, "Photo %d wasn't taken on %s.", p.ID, story.Date)
		}
	}
	return nil
}
