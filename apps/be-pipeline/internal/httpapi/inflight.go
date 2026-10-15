package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// findPhotosTimeout bounds the search for the photos' images in R2.
const findPhotosTimeout = 15 * time.Second

// findPhotosFunc looks up uploaded photos in R2; storage.FindPhotos in production.
type findPhotosFunc func(ctx context.Context, cfg settings.R2, names []string) (map[string]storage.Uploaded, string)

// inFlightImages is each in-flight photo's image in R2, by JSON file path.
type inFlightImages struct {
	// Checked is false when R2 couldn't be searched, and Message says why.
	Checked bool                        `json:"checked"`
	Message string                      `json:"message,omitempty"`
	ByPath  map[string]storage.Uploaded `json:"byPath"`
}

type inFlightResponse struct {
	github.InFlightResult
	Images inFlightImages `json:"images"`
}

// handlePhotosInFlight lists the photo JSON in the open "Add photo data" pull
// request on the GitHub repository from Settings, with each photo's image in
// R2, without changing anything.
func handlePhotosInFlight(store *settings.Store, gh *github.Client, findPhotos findPhotosFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, err := store.GitHub()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.InFlight(ctx, cfg)
		var perr *github.PublishError
		if errors.As(err, &perr) {
			writeError(w, perr.Status, perr.Message)
			return
		}
		if err != nil {
			slog.Error("read photos in flight failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read photos in flight")
			return
		}

		images, err := findImages(r.Context(), store, findPhotos, result.Files)
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}
		writeJSON(w, http.StatusOK, inFlightResponse{InFlightResult: result, Images: images})
	}
}

// findImages looks up each file's photo in the R2 bucket from Settings.
func findImages(ctx context.Context, store *settings.Store, findPhotos findPhotosFunc, files []github.InFlightFile) (inFlightImages, error) {
	images := inFlightImages{ByPath: map[string]storage.Uploaded{}}
	if len(files) == 0 {
		images.Checked = true
		return images, nil
	}
	cfg, err := store.R2()
	if err != nil {
		return images, err
	}
	names := make([]string, len(files))
	for i, f := range files {
		names[i] = f.PhotoName
	}

	ctx, cancel := context.WithTimeout(ctx, findPhotosTimeout)
	defer cancel()
	found, problem := findPhotos(ctx, cfg, names)
	if problem != "" {
		images.Message = problem
		return images, nil
	}
	images.Checked = true
	for _, f := range files {
		if u, ok := found[f.PhotoName]; ok {
			images.ByPath[f.Path] = u
		}
	}
	return images, nil
}
