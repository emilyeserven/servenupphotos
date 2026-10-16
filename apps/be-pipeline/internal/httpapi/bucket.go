package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// listImagesTimeout bounds listing the whole R2 bucket.
const listImagesTimeout = 30 * time.Second

// listImagesFunc lists the images in R2; storage.ListImages in production.
type listImagesFunc func(ctx context.Context, cfg settings.R2) ([]storage.BucketImage, error)

type bucketResponse struct {
	Bucket string                `json:"bucket"`
	Images []storage.BucketImage `json:"images"`
}

// handleBucketImages lists every image in the R2 bucket from Settings,
// without changing anything.
func handleBucketImages(r2 func() (settings.R2, error), list listImagesFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, err := r2()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), listImagesTimeout)
		defer cancel()
		images, err := list(ctx, cfg)
		var lerr *storage.ListError
		if errors.As(err, &lerr) {
			status := http.StatusBadGateway
			if lerr.NotConfigured {
				status = http.StatusBadRequest
			}
			writeError(w, status, lerr.Message)
			return
		}
		if err != nil {
			slog.Error("list bucket failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not list the bucket")
			return
		}
		writeJSON(w, http.StatusOK, bucketResponse{Bucket: strings.TrimSpace(cfg.Bucket), Images: images})
	}
}
