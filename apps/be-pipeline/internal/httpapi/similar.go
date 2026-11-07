package httpapi

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handleFindSimilarPhotos works out every photo's most related photos and
// saves their IDs in its "similarPhotos", as changes waiting for Commit.
func handleFindSimilarPhotos(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), baseURLTimeout)
		defer cancel()
		result, err := gh.FindSimilarPhotos(ctx, cfg)
		writeSocialResult(w, result, err, "could not save the related photos")
	}
}

// handleSetPickedSimilar saves the photos picked by hand to show first in one
// photo's More like this drawer, as a change waiting for Commit.
func handleSetPickedSimilar(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req github.PickedSimilar
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxPhotoDataBytes)).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid picked photos body")
			return
		}
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), baseURLTimeout)
		defer cancel()
		result, err := gh.SetPickedSimilar(ctx, cfg, req)
		writeSocialResult(w, result, err, "could not save the picked photos")
	}
}
