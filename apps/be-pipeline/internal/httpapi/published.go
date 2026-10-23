package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

type publishedResponse struct {
	github.PublishedResult
	Images inFlightImages `json:"images"`
}

// handlePublishedPhotos lists the photo JSON on the base branch of the GitHub
// repository from Settings, the photos already in the portfolio, with each
// photo's image in R2, without changing anything.
func handlePublishedPhotos(store *settings.Store, gh *github.Client, findPhotos findPhotosFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, err := store.GitHub()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.Published(ctx, cfg)
		var perr *github.PublishError
		if errors.As(err, &perr) {
			writePublishError(w, perr)
			return
		}
		if err != nil {
			slog.Error("read published photos failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read published photos")
			return
		}

		files := make([]github.InFlightFile, len(result.Files))
		for i, f := range result.Files {
			files[i] = f.InFlightFile
		}
		images, err := findImages(r.Context(), store, findPhotos, files)
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}
		writeJSON(w, http.StatusOK, publishedResponse{PublishedResult: result, Images: images})
	}
}
