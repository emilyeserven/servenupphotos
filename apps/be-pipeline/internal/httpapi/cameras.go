package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// reapplyTimeout bounds applying the camera overrides again, which only
// reads the photo files as the next Commit will have them.
const reapplyTimeout = time.Minute

// handleSaveCameraOverride saves the body as the path's camera override, new
// or replacing the one there, as a change waiting for Commit.
func handleSaveCameraOverride(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBody(store, publishTimeout, "camera override", "Couldn't save the camera override.",
		func(ctx context.Context, r *http.Request, cfg settings.GitHub, override github.CameraOverride) (any, error) {
			override.ID = r.PathValue("id")
			return gh.SaveCameraOverride(ctx, cfg, override)
		})
}

// handleDeleteCameraOverride removes the path's camera override as a change
// waiting for Commit.
func handleDeleteCameraOverride(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, publishTimeout, "Couldn't remove the camera override.", func(ctx context.Context, r *http.Request, cfg settings.GitHub) (any, error) {
		return gh.DeleteCameraOverride(ctx, cfg, r.PathValue("id"))
	})
}

// handleSaveLensOverride saves the body as the path's lens override, new or
// replacing the one there, as a change waiting for Commit.
func handleSaveLensOverride(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBody(store, publishTimeout, "lens override", "Couldn't save the lens override.",
		func(ctx context.Context, r *http.Request, cfg settings.GitHub, override github.LensOverride) (any, error) {
			override.ID = r.PathValue("id")
			return gh.SaveLensOverride(ctx, cfg, override)
		})
}

// handleDeleteLensOverride removes the path's lens override as a change
// waiting for Commit.
func handleDeleteLensOverride(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, publishTimeout, "Couldn't remove the lens override.", func(ctx context.Context, r *http.Request, cfg settings.GitHub) (any, error) {
		return gh.DeleteLensOverride(ctx, cfg, r.PathValue("id"))
	})
}

// handlePreviewReapplyOverrides lists what applying the camera and lens
// overrides again would change in each photo JSON file, as the Update Data page
// previews it.
func handlePreviewReapplyOverrides(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, reapplyTimeout, "Couldn't read the photo files.", func(ctx context.Context, _ *http.Request, cfg settings.GitHub) (any, error) {
		return gh.PreviewReapplyOverrides(ctx, cfg)
	})
}

// handleReapplyOverrides applies the camera overrides again to every photo
// JSON file, as changes waiting for Commit.
func handleReapplyOverrides(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, reapplyTimeout, "Couldn't apply the camera overrides.", func(ctx context.Context, _ *http.Request, cfg settings.GitHub) (any, error) {
		return gh.ReapplyOverrides(ctx, cfg)
	})
}

// handlePreviewLocationNames lists the countries and cities in each photo
// and place file that are another name of one, as the Update Data page
// previews it.
func handlePreviewLocationNames(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, reapplyTimeout, "Couldn't read the photo and place files.", func(ctx context.Context, _ *http.Request, cfg settings.GitHub) (any, error) {
		return gh.PreviewLocationNames(ctx, cfg)
	})
}

// handleApplyLocationNames writes each of those countries and cities as the
// name that wins over it, as changes waiting for Commit.
func handleApplyLocationNames(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, reapplyTimeout, "Couldn't apply the location names.", func(ctx context.Context, _ *http.Request, cfg settings.GitHub) (any, error) {
		return gh.ApplyLocationNames(ctx, cfg)
	})
}

// handleSaveCustomLens saves the body as the path's custom lens, new or
// replacing the one there, as a change waiting for Commit.
func handleSaveCustomLens(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBody(store, publishTimeout, "custom lens", "Couldn't save the custom lens.",
		func(ctx context.Context, r *http.Request, cfg settings.GitHub, lens github.CustomLens) (any, error) {
			lens.ID = r.PathValue("id")
			return gh.SaveCustomLens(ctx, cfg, lens)
		})
}

// handleDeleteCustomLens removes the path's custom lens as a change waiting
// for Commit.
func handleDeleteCustomLens(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, publishTimeout, "Couldn't remove the custom lens.", func(ctx context.Context, r *http.Request, cfg settings.GitHub) (any, error) {
		return gh.DeleteCustomLens(ctx, cfg, r.PathValue("id"))
	})
}
