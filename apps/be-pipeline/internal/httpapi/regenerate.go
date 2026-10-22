package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/versions"
)

// regenerateFunc remakes some of a photo's versions in R2;
// storage.RegenerateVersions in production.
type regenerateFunc func(ctx context.Context, cfg settings.R2, key string, vs []versions.Version, crop *versions.Crop) (map[string]storage.Uploaded, error)

// thumbnailCropFunc reads the crop saved with a photo's thumbnail in R2;
// storage.ThumbnailCrop in production.
type thumbnailCropFunc func(ctx context.Context, cfg settings.R2, key string) (*versions.Crop, error)

type regenerateRequest struct {
	// Key is the original JPEG's object key.
	Key string `json:"key"`
	// Versions are the names of the versions to make, "thumbnail" among them;
	// every version and the thumbnail when empty.
	Versions []string `json:"versions"`
	// Crop is the square to cut the thumbnail from, replacing the one saved
	// with it; the saved one when left out.
	Crop *versions.Crop `json:"crop"`
}

type regenerateResponse struct {
	Key      string                      `json:"key"`
	Versions map[string]storage.Uploaded `json:"versions"`
}

// handleRegenerateVersions makes the named resized versions of a photo
// already in R2 from its original, replacing any already there, and responds
// with where they ended up.
func handleRegenerateVersions(loadR2 func() (settings.R2, error), regenerate regenerateFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req regenerateRequest
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<16)).Decode(&req); err != nil || req.Key == "" {
			writeError(w, http.StatusBadRequest, "key is required")
			return
		}
		vs, ok := findVersions(req.Versions)
		if !ok {
			writeError(w, http.StatusBadRequest, "no such version")
			return
		}
		if req.Crop != nil && (req.Crop.Size <= 0 || req.Crop.X < 0 || req.Crop.Y < 0) {
			writeError(w, http.StatusBadRequest, "crop needs a size and a corner inside the photo")
			return
		}

		cfg, err := loadR2()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), uploadTimeout)
		defer cancel()
		made, err := regenerate(ctx, cfg, req.Key, vs, req.Crop)
		var uploadErr *storage.UploadError
		switch {
		case errors.As(err, &uploadErr):
			status := uploadErrorStatus(uploadErr)
			if uploadErr.NotFound {
				status = http.StatusNotFound
			}
			writeJSON(w, status, uploadErrorResponse{Message: uploadErr.Message, Cloudflare: uploadErr.Cloudflare})
		case err != nil:
			slog.Error("regenerate versions failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not make the resized versions")
		default:
			writeJSON(w, http.StatusOK, regenerateResponse{Key: req.Key, Versions: made})
		}
	}
}

type thumbnailCropResponse struct {
	Key string `json:"key"`
	// Crop is null when the thumbnail was cut from the middle of the photo,
	// or there is no thumbnail yet.
	Crop *versions.Crop `json:"crop"`
}

// handleThumbnailCrop responds with the crop saved with the thumbnail of the
// photo at the "key" query parameter, the square it was cut from.
func handleThumbnailCrop(loadR2 func() (settings.R2, error), readCrop thumbnailCropFunc) http.HandlerFunc {
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
		crop, err := readCrop(ctx, cfg, key)
		var uploadErr *storage.UploadError
		switch {
		case errors.As(err, &uploadErr):
			status := uploadErrorStatus(uploadErr)
			if uploadErr.NotFound {
				status = http.StatusNotFound
			}
			writeJSON(w, status, uploadErrorResponse{Message: uploadErr.Message, Cloudflare: uploadErr.Cloudflare})
		case err != nil:
			slog.Error("read thumbnail crop failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read the Square Thumbnail's crop")
		default:
			writeJSON(w, http.StatusOK, thumbnailCropResponse{Key: key, Crop: crop})
		}
	}
}

// findVersions looks up each of names, or returns every version and the
// thumbnail when there are none.
func findVersions(names []string) ([]versions.Version, bool) {
	if len(names) == 0 {
		return versions.Published(), true
	}
	vs := make([]versions.Version, 0, len(names))
	for _, name := range names {
		v, ok := versions.FindPublished(name)
		if !ok {
			return nil, false
		}
		vs = append(vs, v)
	}
	return vs, true
}
