package httpapi

import (
	"context"
	"image"
	"log/slog"
	"net/http"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
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
	return withSettings(loadR2, findPhotosTimeout, func(ctx context.Context, w http.ResponseWriter, r *http.Request, cfg settings.R2) {
		key := r.URL.Query().Get("key")
		if key == "" {
			writeError(w, http.StatusBadRequest, keyMessage)
			return
		}
		faces, err := read(ctx, cfg, key)
		writeR2Result(w, facesResponse{Key: key, Faces: nonNilFaces(faces)}, err, "Couldn't read the pixelated faces.")
	})
}

// handleDetectFaces downloads the original at the body's "key" from R2 and
// responds with the faces found on it, as boxes to pixelate. Nothing is
// changed: the page shows them to check and adjust before remaking the
// versions.
func handleDetectFaces(loadR2 func() (settings.R2, error), get getPhotoFunc, detect detectFacesFunc) http.HandlerFunc {
	return withBody("photo's key", 1<<12, func(w http.ResponseWriter, r *http.Request, req bucketKeyRequest) {
		if req.Key == "" {
			writeError(w, http.StatusBadRequest, keyMessage)
			return
		}
		withSettings(loadR2, detectFacesTimeout, func(ctx context.Context, w http.ResponseWriter, _ *http.Request, cfg settings.R2) {
			faces, status, msg := detectFaces(ctx, cfg, req.Key, get, detect)
			if status != http.StatusOK {
				writeError(w, status, msg)
				return
			}
			writeJSON(w, http.StatusOK, facesResponse{Key: req.Key, Faces: nonNilFaces(faces)})
		})(w, r)
	})
}

// detectFaces looks for faces on the original at key in R2. On failure it
// returns the status and message to send.
func detectFaces(ctx context.Context, cfg settings.R2, key string, get getPhotoFunc, detect detectFacesFunc) (versions.Faces, int, string) {
	photo, err := get(ctx, cfg, key)
	if err != nil {
		status, msg := getPhotoError(err)
		return nil, status, msg
	}
	defer photo.Close() //nolint:errcheck // read-only
	img, err := versions.Decode(photo)
	if err != nil {
		return nil, http.StatusUnprocessableEntity, "Couldn't read the original JPEG to look for faces."
	}
	faces, err := detect(img)
	if err != nil {
		slog.Error("detect faces failed", "err", err)
		return nil, http.StatusInternalServerError, "Couldn't look for faces."
	}
	return faces, http.StatusOK, ""
}

// nonNilFaces is faces, or an empty list instead of nil.
func nonNilFaces(faces versions.Faces) versions.Faces {
	if faces == nil {
		return versions.Faces{}
	}
	return faces
}
