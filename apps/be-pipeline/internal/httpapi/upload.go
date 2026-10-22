package httpapi

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/versions"
)

// uploadTimeout bounds how long making a photo's versions and uploading them
// all to R2 may take.
const uploadTimeout = 120 * time.Second

// uploadFunc puts a photo in R2; storage.UploadPhoto in production.
type uploadFunc func(ctx context.Context, cfg settings.R2, name string, body io.ReadSeeker, opts storage.UploadOptions) (storage.UploadResult, error)

// uploadErrorResponse is the body of a failed upload: the reason, plus the
// photos already under that name or what Cloudflare answered, when known.
type uploadErrorResponse struct {
	Message    string                      `json:"message"`
	SameName   []storage.BucketImage       `json:"sameName,omitempty"`
	Cloudflare *storage.CloudflareResponse `json:"cloudflare,omitempty"`
}

// handleUpload uploads the JPEG in the "photo" field of a multipart form, and
// its resized WEBP versions, to the R2 bucket in the stored settings and
// responds with their keys and URLs.
// Number fields "cropX", "cropY" and "cropSize" before the photo pick the
// square its thumbnail is cut from; without them it is the photo's middle.
// When the bucket already has a different photo under the same name it
// responds 409 with those photos instead, unless a "sameName" field set to
// "keep" comes before the photo.
func handleUpload(loadR2 func() (settings.R2, error), upload uploadFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		photo, ok := receivePhoto(w, r)
		if !ok {
			return
		}
		defer os.Remove(photo.path) //nolint:errcheck // best-effort cleanup

		crop, ok := parseCrop(photo.fields)
		if !ok {
			writeError(w, http.StatusBadRequest, "cropX, cropY and cropSize must be whole numbers, with a size above 0")
			return
		}

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
		opts := storage.UploadOptions{KeepSameName: photo.fields["sameName"] == "keep", Crop: crop}
		res, err := upload(ctx, cfg, photo.name, f, opts)
		var uploadErr *storage.UploadError
		switch {
		case errors.As(err, &uploadErr):
			writeJSON(w, uploadErrorStatus(uploadErr), uploadErrorResponse{
				Message:    uploadErr.Message,
				SameName:   uploadErr.SameName,
				Cloudflare: uploadErr.Cloudflare,
			})
		case err != nil:
			slog.Error("upload failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not upload photo")
		default:
			writeJSON(w, http.StatusOK, res)
		}
	}
}

// parseCrop reads the thumbnail's crop from the form's "cropX", "cropY" and
// "cropSize" fields: nil when there are none, and false when any is missing
// or not a whole number, or the size isn't above 0. A crop past the photo's
// edges is fitted to it when the thumbnail is made.
func parseCrop(fields map[string]string) (*versions.Crop, bool) {
	raw := [3]string{fields["cropX"], fields["cropY"], fields["cropSize"]}
	if raw == [3]string{} {
		return nil, true
	}
	var n [3]int
	for i, s := range raw {
		v, err := strconv.Atoi(s)
		if err != nil {
			return nil, false
		}
		n[i] = v
	}
	if n[2] <= 0 {
		return nil, false
	}
	return &versions.Crop{X: n[0], Y: n[1], Size: n[2]}, true
}

// uploadErrorStatus is the HTTP status for a failed upload.
func uploadErrorStatus(err *storage.UploadError) int {
	switch {
	case err.NotConfigured:
		return http.StatusBadRequest
	case err.NotAPhoto:
		return http.StatusUnprocessableEntity
	case len(err.SameName) > 0:
		return http.StatusConflict
	default:
		return http.StatusBadGateway
	}
}
