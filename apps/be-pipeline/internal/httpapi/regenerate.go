package httpapi

import (
	"context"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/versions"
)

// regenerateFunc remakes some of a photo's versions in R2;
// storage.RegenerateVersions in production.
type regenerateFunc func(ctx context.Context, cfg settings.R2, key string, vs []versions.Version, crop *versions.Crop, faces *versions.Faces) (map[string]storage.Uploaded, error)

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
	// Faces are the boxes to pixelate on every version, replacing the ones
	// saved with them, which remakes every version; an empty list stops
	// pixelating. The saved ones when left out.
	Faces *versions.Faces `json:"faces"`
}

type regenerateResponse struct {
	Key      string                      `json:"key"`
	Versions map[string]storage.Uploaded `json:"versions"`
}

// handleRegenerateVersions makes the named resized versions of a photo
// already in R2 from its original, replacing any already there, and responds
// with where they ended up.
func handleRegenerateVersions(loadR2 func() (settings.R2, error), regenerate regenerateFunc) http.HandlerFunc {
	return withBody("versions to make", 1<<16, func(w http.ResponseWriter, r *http.Request, req regenerateRequest) {
		vs, msg := checkRegenerate(req)
		if msg != "" {
			writeError(w, http.StatusBadRequest, msg)
			return
		}
		withSettings(loadR2, uploadTimeout, func(ctx context.Context, w http.ResponseWriter, _ *http.Request, cfg settings.R2) {
			made, err := regenerate(ctx, cfg, req.Key, vs, req.Crop, req.Faces)
			writeR2Result(w, regenerateResponse{Key: req.Key, Versions: made}, err, "Couldn't make the resized versions.")
		})(w, r)
	})
}

// checkRegenerate is the versions req asks for, or why it can't be done.
func checkRegenerate(req regenerateRequest) ([]versions.Version, string) {
	if req.Key == "" {
		return nil, keyMessage
	}
	vs, ok := findVersions(req.Versions)
	if !ok {
		return nil, noSuchVersionMessage
	}
	if req.Crop != nil && (req.Crop.Size <= 0 || req.Crop.X < 0 || req.Crop.Y < 0) {
		return nil, "Give the crop a size above 0 and a corner inside the photo."
	}
	if req.Faces != nil {
		if msg := req.Faces.Valid(); msg != "" {
			return nil, msg
		}
	}
	return vs, ""
}

// noSuchVersionMessage is the answer to a request for a resized version the
// pipeline doesn't make.
const noSuchVersionMessage = "There's no resized version by that name. Reload the page to get the current list."

type thumbnailCropResponse struct {
	Key string `json:"key"`
	// Crop is null when the thumbnail was cut from the middle of the photo,
	// or there is no thumbnail yet.
	Crop *versions.Crop `json:"crop"`
}

// handleThumbnailCrop responds with the crop saved with the thumbnail of the
// photo at the "key" query parameter, the square it was cut from.
func handleThumbnailCrop(loadR2 func() (settings.R2, error), readCrop thumbnailCropFunc) http.HandlerFunc {
	return withSettings(loadR2, findPhotosTimeout, func(ctx context.Context, w http.ResponseWriter, r *http.Request, cfg settings.R2) {
		key := r.URL.Query().Get("key")
		if key == "" {
			writeError(w, http.StatusBadRequest, keyMessage)
			return
		}
		crop, err := readCrop(ctx, cfg, key)
		writeR2Result(w, thumbnailCropResponse{Key: key, Crop: crop}, err, "Couldn't read the Square Thumbnail's crop.")
	})
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
