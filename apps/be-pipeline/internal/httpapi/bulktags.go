package httpapi

import (
	"context"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// bulkTagPick is the body of a Bulk Tagging pick: the photos already shown,
// to leave out, and how many to pick.
type bulkTagPick struct {
	Skip []string `json:"skip"`
	// Count is how many photos to pick, 1 to 50; 0 picks the default 5.
	Count int `json:"count"`
}

// bulkTagAnswer is the body of a Bulk Tagging preview: the picked photos and
// the LLM's answer pasted for them.
type bulkTagAnswer struct {
	Paths  []string `json:"paths"`
	Answer string   `json:"answer"`
}

// handlePickBulkTagPhotos picks up to the asked number of related photos for
// Bulk Tagging, leaving out the photos already shown.
func handlePickBulkTagPhotos(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return handleBulkTags(store, "photo pick", "could not pick the photos",
		func(ctx context.Context, cfg settings.GitHub, req bulkTagPick) (any, error) {
			return gh.PickBulkTagPhotos(ctx, cfg, req.Skip, req.Count)
		})
}

// handlePreviewBulkTags reads the LLM's pasted answer for the picked photos
// and says which tags each would get, without saving anything.
func handlePreviewBulkTags(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return handleBulkTags(store, "bulk tags answer", "could not read the answer",
		func(ctx context.Context, cfg settings.GitHub, req bulkTagAnswer) (any, error) {
			return gh.PreviewBulkTags(ctx, cfg, req.Paths, req.Answer)
		})
}

// handleApplyBulkTags makes the reviewed new tags and adds the tags to each
// photo, as changes waiting for Commit.
func handleApplyBulkTags(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return handleBulkTags(store, "bulk tags", "could not save the tags",
		func(ctx context.Context, cfg settings.GitHub, req github.BulkTags) (any, error) {
			return gh.ApplyBulkTags(ctx, cfg, req)
		})
}

// handleBulkTags decodes a Bulk Tagging step's body, a T named kind, runs the
// step and writes its result.
func handleBulkTags[T any](store *settings.Store, kind, failure string, run func(context.Context, settings.GitHub, T) (any, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req T
		if !decodeEntry(w, r, &req, kind) {
			return
		}
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), reapplyTimeout)
		defer cancel()
		result, err := run(ctx, cfg, req)
		writeSocialResult(w, result, err, failure)
	}
}

// handlePickBulkPlacePhotos picks up to the asked number of related photos
// without places for Bulk Places, leaving out the photos already shown.
func handlePickBulkPlacePhotos(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return handleBulkTags(store, "photo pick", "could not pick the photos",
		func(ctx context.Context, cfg settings.GitHub, req bulkTagPick) (any, error) {
			return gh.PickBulkPlacePhotos(ctx, cfg, req.Skip, req.Count)
		})
}

// handleApplyBulkPlaces makes the reviewed new places and gives each photo
// its places, as changes waiting for Commit.
func handleApplyBulkPlaces(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return handleBulkTags(store, "bulk places", "could not save the places",
		func(ctx context.Context, cfg settings.GitHub, req github.BulkPlaces) (any, error) {
			return gh.ApplyBulkPlaces(ctx, cfg, req)
		})
}
