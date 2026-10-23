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
	return func(w http.ResponseWriter, r *http.Request) {
		var override github.CameraOverride
		if !decodeEntry(w, r, &override, "camera override") {
			return
		}
		override.ID = r.PathValue("id")
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.SaveCameraOverride(ctx, cfg, override)
		writeSocialResult(w, result, err, "could not save the camera override")
	}
}

// handleDeleteCameraOverride removes the path's camera override as a change
// waiting for Commit.
func handleDeleteCameraOverride(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.DeleteCameraOverride(ctx, cfg, r.PathValue("id"))
		writeSocialResult(w, result, err, "could not remove the camera override")
	}
}

// handlePreviewReapplyOverrides lists what applying the camera overrides
// again would change in each photo JSON file, as the Update Data page
// previews it.
func handlePreviewReapplyOverrides(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return handleReapply(store, "could not read the photo files", func(ctx context.Context, cfg settings.GitHub) (any, error) {
		return gh.PreviewReapplyOverrides(ctx, cfg)
	})
}

// handleReapplyOverrides applies the camera overrides again to every photo
// JSON file, as changes waiting for Commit.
func handleReapplyOverrides(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return handleReapply(store, "could not apply the camera overrides", func(ctx context.Context, cfg settings.GitHub) (any, error) {
		return gh.ReapplyOverrides(ctx, cfg)
	})
}

func handleReapply(store *settings.Store, failure string, run func(context.Context, settings.GitHub) (any, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), reapplyTimeout)
		defer cancel()
		result, err := run(ctx, cfg)
		writeSocialResult(w, result, err, failure)
	}
}

// handleSaveCustomLens saves the body as the path's custom lens, new or
// replacing the one there, as a change waiting for Commit.
func handleSaveCustomLens(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var lens github.CustomLens
		if !decodeEntry(w, r, &lens, "custom lens") {
			return
		}
		lens.ID = r.PathValue("id")
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.SaveCustomLens(ctx, cfg, lens)
		writeSocialResult(w, result, err, "could not save the custom lens")
	}
}

// handleDeleteCustomLens removes the path's custom lens as a change waiting
// for Commit.
func handleDeleteCustomLens(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.DeleteCustomLens(ctx, cfg, r.PathValue("id"))
		writeSocialResult(w, result, err, "could not remove the custom lens")
	}
}
