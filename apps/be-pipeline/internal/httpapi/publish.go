package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/colors"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// maxPhotoDataBytes caps the size of a photo data body.
const maxPhotoDataBytes = 64 << 10

// publishTimeout bounds a publish, which makes several GitHub calls in a row.
const publishTimeout = 30 * time.Second

// publishColorsTimeout bounds reading a photo's colors before a publish,
// which downloads its original from R2 unless its upload just read them.
const publishColorsTimeout = 20 * time.Second

// handlePublishPhoto saves a photo's sanitized EXIF as JSON in a pull request
// on the GitHub repository from Settings, with its colors read from its
// original in R2 by readColors and its perceptual hash from its Small version
// by readHash when they're there. A photo that looks nearly the same as
// others goes in a compare group with them.
func handlePublishPhoto(store *settings.Store, gh *github.Client, readColors github.ColorReader, readHash github.HashReader) http.HandlerFunc {
	// The colors and the hash have their own timeouts, so the publish's
	// starts once they're read.
	return withGitHubBody(store, publishColorsTimeout+publishHashTimeout+publishTimeout, "photo data", "Couldn't save the photo data.",
		func(ctx context.Context, _ *http.Request, cfg settings.GitHub, photo github.Photo) (any, error) {
			photo.Colors = photoColors(ctx, readColors, photo.Sanitized.Images.Key)
			photo.PerceptualHash = photoHash(ctx, readHash, photo.Sanitized.Images.Small)
			ctx, cancel := context.WithTimeout(ctx, publishTimeout)
			defer cancel()
			return gh.Publish(ctx, cfg, photo)
		})
}

// photoColors reads the colors of the original at key, or nil when there's no
// key or they can't be read, so the photo is saved without them; Update
// Data's Colors can add them later.
func photoColors(ctx context.Context, readColors github.ColorReader, key *string) *colors.Summary {
	if key == nil || *key == "" {
		return nil
	}
	ctx, cancel := context.WithTimeout(ctx, publishColorsTimeout)
	defer cancel()
	analysis, msg := readColors(ctx, *key)
	if msg != "" {
		slog.Warn("could not read the photo's colors", "key", *key, "reason", msg)
		return nil
	}
	return &analysis
}

// handleAllPhotosCheck looks for the photo in the body, identified by its file
// name, GPS position and creation date, in ALLPHOTOS.json on GitHub, so a
// photo already in the portfolio isn't uploaded or saved again.
func handleAllPhotosCheck(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBody(store, publishTimeout, "photo", "Couldn't check ALLPHOTOS.json.",
		func(ctx context.Context, _ *http.Request, cfg settings.GitHub, photo github.PhotoIdentity) (any, error) {
			return gh.FindInPullRequest(ctx, cfg, photo)
		})
}
