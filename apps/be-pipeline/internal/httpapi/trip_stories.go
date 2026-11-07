package httpapi

import (
	"context"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handleSaveTripStory saves the body as the path's day's story for the
// portfolio's Trip page, new or replacing the one there, as a change waiting
// for Commit.
func handleSaveTripStory(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var story github.TripStory
		if !decodeEntryUpTo(w, r, &story, "story", maxTripLineBytes) {
			return
		}
		story.ID = r.PathValue("id")
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.SaveTripStory(ctx, cfg, story)
		writeSocialResult(w, result, err, "could not save the story")
	}
}

// handleDeleteTripStory removes the path's day's story as a change waiting
// for Commit.
func handleDeleteTripStory(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.DeleteTripStory(ctx, cfg, r.PathValue("id"))
		writeSocialResult(w, result, err, "could not remove the story")
	}
}
