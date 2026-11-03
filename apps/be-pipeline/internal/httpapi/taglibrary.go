package httpapi

import (
	"context"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// maxTagLibraryBytes is the largest Tag library answer or save, far more
// than one with a change to every tag and photo needs.
const maxTagLibraryBytes = 4 << 20

// handleExportTagLibrary reads every tag and photo with its tags, for the Tag
// library prompt, without saving anything.
func handleExportTagLibrary(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return handleBulkTags(store, "tag library export", "could not read the tags and photos",
		func(ctx context.Context, cfg settings.GitHub, _ struct{}) (any, error) {
			return gh.ExportTagLibrary(ctx, cfg)
		})
}

// handlePreviewTagLibrary reads the LLM's pasted answer with changes to the
// whole tag library, and says what each would do, without saving anything.
func handlePreviewTagLibrary(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return handleBulkTagsUpTo(store, maxTagLibraryBytes, "tag library answer", "could not read the answer",
		func(ctx context.Context, cfg settings.GitHub, req pruneTagAnswer) (any, error) {
			return gh.PreviewTagLibrary(ctx, cfg, req.Answer)
		})
}

// handleApplyTagLibrary saves the reviewed changes to the tag library, as
// changes waiting for Commit.
func handleApplyTagLibrary(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return handleBulkTagsUpTo(store, maxTagLibraryBytes, "tag library", "could not change the tags",
		func(ctx context.Context, cfg settings.GitHub, req github.TagLibrary) (any, error) {
			return gh.ApplyTagLibrary(ctx, cfg, req)
		})
}
