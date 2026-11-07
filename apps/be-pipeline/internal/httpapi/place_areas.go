package httpapi

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handlePlaceArea answers the path's place's area, or null when it has none.
func handlePlaceArea(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		area, err := gh.PlaceAreaOf(ctx, cfg, r.PathValue("id"))
		writeSocialResult(w, area, err, "could not read the place's area")
	}
}

// handleSavePlaceArea saves the body as the path's place's area, in the
// changes waiting for Commit.
func handleSavePlaceArea(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var area github.PlaceArea
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxAreaBody)).Decode(&area); err != nil {
			writeError(w, http.StatusBadRequest, "Send the area as JSON with its outline in \"shape\".")
			return
		}
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.SavePlaceArea(ctx, cfg, r.PathValue("id"), area)
		writeSocialResult(w, result, err, "could not save the place's area")
	}
}

// maxAreaBody is the largest area body read: 5,000 points with room to spare.
const maxAreaBody = 1 << 20

// handleDeletePlaceArea removes the path's place's area, in the changes
// waiting for Commit.
func handleDeletePlaceArea(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.DeletePlaceArea(ctx, cfg, r.PathValue("id"))
		writeSocialResult(w, result, err, "could not remove the place's area")
	}
}
