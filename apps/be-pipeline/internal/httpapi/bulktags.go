package httpapi

import (
	"context"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// bulkTagAnswer is the body of a Bulk Tagging preview: the picked photos and
// the LLM's answer pasted for them.
type bulkTagAnswer struct {
	Paths  []string `json:"paths"`
	Answer string   `json:"answer"`
}

// handleCountUntaggedPhotos says how many photo files have no tags yet, for
// Bulk Tagging to show before anything is picked.
func handleCountUntaggedPhotos(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return handleBulkTags(store, "untagged count", "could not count the photos without tags",
		func(ctx context.Context, cfg settings.GitHub, _ struct{}) (any, error) {
			return gh.CountUntaggedPhotos(ctx, cfg)
		})
}

// handlePickBulkTagPhotos picks up to the asked number of photos for Bulk
// Tagging, related ones or any, leaving out the photos already shown.
func handlePickBulkTagPhotos(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return handleBulkTags(store, "photo pick", "could not pick the photos",
		func(ctx context.Context, cfg settings.GitHub, req github.BulkTagPickOptions) (any, error) {
			return gh.PickBulkTagPhotos(ctx, cfg, req)
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

// handlePickGenrePhotos picks up to the asked number of photos without
// genres for Genre Suggestions, leaving out the photos already shown.
func handlePickGenrePhotos(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return handleBulkTags(store, "photo pick", "could not pick the photos",
		func(ctx context.Context, cfg settings.GitHub, req github.BulkTagPickOptions) (any, error) {
			return gh.PickGenrePhotos(ctx, cfg, req.Skip, req.Count)
		})
}

// handlePreviewGenreSuggestions reads the LLM's pasted answer for the picked
// photos and says which genres each would get, without saving anything.
func handlePreviewGenreSuggestions(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return handleBulkTags(store, "genre suggestions answer", "could not read the answer",
		func(ctx context.Context, cfg settings.GitHub, req bulkTagAnswer) (any, error) {
			return gh.PreviewGenreSuggestions(ctx, cfg, req.Paths, req.Answer)
		})
}

// handleApplyGenreSuggestions makes the reviewed new genres and adds the
// genres to each photo, as changes waiting for Commit.
func handleApplyGenreSuggestions(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return handleBulkTags(store, "genre suggestions", "could not save the genres",
		func(ctx context.Context, cfg settings.GitHub, req github.GenreSuggestions) (any, error) {
			return gh.ApplyGenreSuggestions(ctx, cfg, req)
		})
}
