package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// bioUploadTimeout bounds how long making a self-portrait's two versions and
// putting them in R2 may take, after it's received.
const bioUploadTimeout = 60 * time.Second

// handleSaveBio saves the body as the bio file, as a change waiting for
// Commit.
func handleSaveBio(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBody(store, publishTimeout, "bio", "could not save the bio",
		func(ctx context.Context, r *http.Request, cfg settings.GitHub, bio github.Bio) (any, error) {
			bio.ID = r.PathValue("id")
			return gh.SaveBio(ctx, cfg, bio)
		})
}

// handleUploadBioPortrait puts the self-portrait in the "image" field of a
// multipart form in R2 right away, as its two WEBP versions, responding with
// their links and size for the bio file to point at.
func handleUploadBioPortrait(loadR2 func() (settings.R2, error)) http.HandlerFunc {
	return handlePictureUpload(loadR2, maxUploadBytes, bioUploadTimeout, storage.UploadBioPortrait)
}
