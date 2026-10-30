package httpapi

import (
	"context"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// handlePickAlbumPhotos picks up to the asked number of related photos without
// an album for Album Suggestions, leaving out the photos already shown.
func handlePickAlbumPhotos(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return handlePromptStep(store, "photo pick", "could not pick the photos",
		func(ctx context.Context, cfg settings.GitHub, req bulkTagPick) (any, error) {
			return gh.PickAlbumPhotos(ctx, cfg, req.Skip, req.Count)
		})
}

// handlePreviewAlbumSuggestions reads the LLM's pasted answer for the picked
// photos and says which album each would go in, without saving anything.
func handlePreviewAlbumSuggestions(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return handlePromptStep(store, "album suggestions answer", "could not read the answer",
		func(ctx context.Context, cfg settings.GitHub, req bulkTagAnswer) (any, error) {
			return gh.PreviewAlbumSuggestions(ctx, cfg, req.Paths, req.Answer)
		})
}

// handleApplyAlbumSuggestions makes the reviewed new albums and puts each
// photo in its albums, as changes waiting for Commit.
func handleApplyAlbumSuggestions(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return handlePromptStep(store, "album suggestions", "could not save the albums",
		func(ctx context.Context, cfg settings.GitHub, req github.AlbumSuggestions) (any, error) {
			return gh.ApplyAlbumSuggestions(ctx, cfg, req)
		})
}
