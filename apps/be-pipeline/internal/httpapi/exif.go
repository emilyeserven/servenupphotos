package httpapi

import (
	"fmt"
	"log/slog"
	"net/http"
	"os"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/colors"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/exif"
)

type exifResponse struct {
	File string `json:"file"`
	// Exif is null when exiftool is not available.
	Exif map[string]any `json:"exif"`
	// Sanitized is null when exiftool is not available.
	Sanitized *exif.Sanitized `json:"sanitized"`
	Colors    colors.Analysis `json:"colors"`
}

// handleExif reads the JPEG in the "photo" field of a multipart form and
// responds with its EXIF metadata and color summary.
func handleExif(extractor exif.Extractor) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		photo, ok := receivePhoto(w, r)
		if !ok {
			return
		}
		defer os.Remove(photo.path) //nolint:errcheck // best-effort cleanup

		res, status, msg := analyzePhoto(extractor, photo.path, photo.name)
		if status != http.StatusOK {
			writeError(w, status, msg)
			return
		}
		writeJSON(w, http.StatusOK, res)
	}
}

// analyzePhoto reads the EXIF metadata and color summary of the JPEG at path,
// returned under name. On failure it returns the status and message to send.
func analyzePhoto(extractor exif.Extractor, path, name string) (exifResponse, int, string) {
	res := exifResponse{File: name}
	var err error
	if extractor != nil {
		if res.Exif, err = extractor.Extract(path); err != nil {
			slog.Error("exif extraction failed", "err", err)
			return res, http.StatusInternalServerError, "could not read photo metadata"
		}
		sanitized := exif.Sanitize(res.Exif)
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
