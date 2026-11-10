package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"image"
	"log/slog"
	"net/http"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/versions"
)

// detectFacesTimeout bounds downloading an original from R2 and looking for
// faces in it.
const detectFacesTimeout = 60 * time.Second

// savedFacesFunc reads the faces pixelated on a photo's versions in R2;
// storage.SavedFaces in production.
type savedFacesFunc func(ctx context.Context, cfg settings.R2, key string) (versions.Faces, error)

// detectFacesFunc finds the faces on a decoded photo; versions.DetectFaces in
// production.
type detectFacesFunc func(img image.Image) (versions.Faces, error)

type facesResponse struct {
	Key string `json:"key"`
	// Faces are never null, so the page can list them as they are.
	Faces versions.Faces `json:"faces"`
}

// handleSavedFaces responds with the faces pixelated on every version of the
// photo at the "key" query parameter, as saved with them in R2.
func handleSavedFaces(loadR2 func() (settings.R2, error), read savedFacesFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		key := r.URL.Query().Get("key")
		if key == "" {
			writeError(w, http.StatusBadRequest, "key is required")
			return
		}
		cfg, err := loadR2()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), findPhotosTimeout)
		defer cancel()
		faces, err := read(ctx, cfg, key)
		var uploadErr *storage.UploadError
		switch {
		case errors.As(err, &uploadErr):
			status := uploadErrorStatus(uploadErr)
			if uploadErr.NotFound {
				status = http.StatusNotFound
			}
			writeJSON(w, status, uploadErrorResponse{Message: uploadErr.Message, Cloudflare: uploadErr.Cloudflare})
		case err != nil:
			slog.Error("read saved faces failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read the pixelated faces")
		default:
			writeJSON(w, http.StatusOK, facesResponse{Key: key, Faces: nonNilFaces(faces)})
		}
	}
}

// handleDetectFaces downloads the original at the body's "key" from R2 and
// responds with the faces found on it, as boxes to pixelate. Nothing is
// changed: the page shows them to check and adjust before remaking the
// versions.
func handleDetectFaces(loadR2 func() (settings.R2, error), get getPhotoFunc, detect detectFacesFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Key string `json:"key"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<12)).Decode(&req); err != nil || req.Key == "" {
			writeError(w, http.StatusBadRequest, "key is required")
			return
		}
		cfg, err := loadR2()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), detectFacesTimeout)
		defer cancel()
		photo, err := get(ctx, cfg, req.Key)
		if err != nil {
			status, msg := getPhotoError(err)
			writeError(w, status, msg)
			return
		}
		defer photo.Close() //nolint:errcheck // read-only
		img, err := versions.Decode(photo)
		if err != nil {
			writeError(w, http.StatusUnprocessableEntity, "Couldn't read the original JPEG to look for faces.")
			return
		}
		faces, err := detect(img)
		if err != nil {
			slog.Error("detect faces failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not look for faces")
			return
		}
		writeJSON(w, http.StatusOK, facesResponse{Key: req.Key, Faces: nonNilFaces(faces)})
	}
}

// nonNilFaces is faces, or an empty list instead of nil.
func nonNilFaces(faces versions.Faces) versions.Faces {
	if faces == nil {
		return versions.Faces{}
	}
	return faces
}
