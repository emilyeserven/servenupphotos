package httpapi

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/colors"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/exif"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// overridesTimeout bounds reading the camera overrides for a photo's EXIF,
// which reads GitHub only the first time after the pipeline starts.
const overridesTimeout = 30 * time.Second

// overridesFunc returns the camera overrides a photo's sanitized EXIF gets,
// or none when they can't be read. A nil overridesFunc gives none.
type overridesFunc func(ctx context.Context) []github.CameraOverride

// cameraOverrides reads the camera overrides as the next Commit will have
// them, from the repository in Settings. Without one set up, or when GitHub
// can't be read, a photo keeps its EXIF values.
func cameraOverrides(store *settings.Store, gh *github.Client) overridesFunc {
	if store == nil || gh == nil {
		return nil
	}
	return func(ctx context.Context) []github.CameraOverride {
		cfg, err := store.GitHub()
		if err != nil || cfg.Repo == "" || cfg.Token == "" {
			return nil
		}
		ctx, cancel := context.WithTimeout(ctx, overridesTimeout)
		defer cancel()
		overrides, err := gh.CameraOverrides(ctx, cfg)
		if err != nil {
			slog.Warn("camera overrides not applied", "err", err)
		}
		return overrides
	}
}

// read is the overrides f returns, or none when f is nil.
func (f overridesFunc) read(ctx context.Context) []github.CameraOverride {
	if f == nil {
		return nil
	}
	return f(ctx)
}

type exifResponse struct {
	File string `json:"file"`
	// Exif is null when exiftool is not available.
	Exif map[string]any `json:"exif"`
	// Sanitized is null when exiftool is not available.
	Sanitized *exif.Sanitized `json:"sanitized"`
	Colors    colors.Analysis `json:"colors"`
}

// handleExif reads the JPEG in the "photo" field of a multipart form and
// responds with its EXIF metadata and color summary, its sanitized EXIF with
// the camera overrides for its camera made over it.
func handleExif(extractor exif.Extractor, overrides overridesFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		photo, ok := receivePhoto(w, r)
		if !ok {
			return
		}
		defer os.Remove(photo.path) //nolint:errcheck // best-effort cleanup

		res, status, msg := analyzePhoto(extractor, photo.path, photo.name, overrides.read(r.Context()))
		if status != http.StatusOK {
			writeError(w, status, msg)
			return
		}
		writeJSON(w, http.StatusOK, res)
	}
}

// analyzePhoto reads the EXIF metadata and color summary of the JPEG at path,
// returned under name, with overrides made over the sanitized EXIF. On
// failure it returns the status and message to send.
func analyzePhoto(extractor exif.Extractor, path, name string, overrides []github.CameraOverride) (exifResponse, int, string) {
	res := exifResponse{File: name}
	var err error
	if extractor != nil {
		if res.Exif, err = extractor.Extract(path); err != nil {
			slog.Error("exif extraction failed", "err", err)
			return res, http.StatusInternalServerError, "could not read photo metadata"
		}
		sanitized := github.ApplyCameraOverrides(overrides, exif.Sanitize(res.Exif))
		res.Sanitized = &sanitized
	}

	if res.Colors, err = analyzeColors(path); err != nil {
		slog.Warn("color analysis failed", "err", err)
		return res, http.StatusUnprocessableEntity, "could not decode photo"
	}
	return res, http.StatusOK, ""
}

func analyzeColors(path string) (colors.Analysis, error) {
	f, err := os.Open(path) //nolint:gosec // path comes from os.CreateTemp
	if err != nil {
		return colors.Analysis{}, fmt.Errorf("open upload: %w", err)
	}
	defer f.Close() //nolint:errcheck // read-only
	return colors.Analyze(f)
}
