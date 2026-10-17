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
type regenerateFunc func(ctx context.Context, cfg settings.R2, key string, vs []versions.Version) (map[string]storage.Uploaded, error)

type regenerateRequest struct {
	// Key is the original JPEG's object key.
	Key string `json:"key"`
	// Versions are the names of the versions to make; every version when empty.
	Versions []string `json:"versions"`
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

		cfg, err := loadR2()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), uploadTimeout)
		defer cancel()
		made, err := regenerate(ctx, cfg, req.Key, vs)
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

// findVersions looks up each of names, or returns every version when there are none.
func findVersions(names []string) ([]versions.Version, bool) {
	if len(names) == 0 {
		return versions.All, true
	}
	vs := make([]versions.Version, 0, len(names))
	for _, name := range names {
		v, ok := versions.Find(name)
		if !ok {
			return nil, false
		}
		vs = append(vs, v)
	}
	return vs, true
}
