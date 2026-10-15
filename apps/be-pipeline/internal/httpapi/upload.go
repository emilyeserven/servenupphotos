package httpapi

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// uploadTimeout bounds how long an upload to R2 may take.
const uploadTimeout = 60 * time.Second

// uploadFunc puts a photo in R2; storage.UploadPhoto in production.
type uploadFunc func(ctx context.Context, cfg settings.R2, name string, body io.ReadSeeker) (storage.Uploaded, error)

// handleUpload uploads the JPEG in the "photo" field of a multipart form to
// the R2 bucket in the stored settings and responds with its key and URL.
func handleUpload(loadR2 func() (settings.R2, error), upload uploadFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		photo, ok := receivePhoto(w, r)
		if !ok {
			return
		}
		defer os.Remove(photo.path) //nolint:errcheck // best-effort cleanup

		cfg, err := loadR2()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}

		f, err := os.Open(photo.path)
		if err != nil {
			slog.Error("open upload failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read photo")
			return
		}
		defer f.Close() //nolint:errcheck // read-only

		ctx, cancel := context.WithTimeout(r.Context(), uploadTimeout)
		defer cancel()
		res, err := upload(ctx, cfg, photo.name, f)
		var uploadErr *storage.UploadError
		switch {
		case errors.As(err, &uploadErr) && uploadErr.NotConfigured:
			writeError(w, http.StatusConflict, uploadErr.Message)
		case errors.As(err, &uploadErr):
			writeError(w, http.StatusBadGateway, uploadErr.Message)
		case err != nil:
			slog.Error("upload failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not upload photo")
		default:
			writeJSON(w, http.StatusOK, res)
		}
	}
}
