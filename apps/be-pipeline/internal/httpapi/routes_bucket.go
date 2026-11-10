package httpapi

import (
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/versions"
)

// registerBucketRoutes adds the Explore Bucket and Manage Sizes routes: what's in R2, deleting from it, and remaking versions; finding and reading the faces pixelated on them; and downloading an original.
func registerBucketRoutes(mux *http.ServeMux, d routeDeps) {
	mux.HandleFunc("GET /photos/bucket", handleBucketImages(d.store.R2, storage.ListImages))
	mux.HandleFunc("POST /photos/bucket/exif", handleBucketExif(d.extractor, d.store.R2, storage.GetPhoto, cameraOverrides(d.store, d.gh)))
	mux.HandleFunc("POST /photos/bucket/delete", handleDeleteBucketImages(d.store.R2, storage.DeleteImage))
	mux.HandleFunc("POST /photos/bucket/versions", handleRegenerateVersions(d.store.R2, storage.RegenerateVersions))
	mux.HandleFunc("GET /photos/bucket/thumbnail-crop", handleThumbnailCrop(d.store.R2, storage.ThumbnailCrop))
	mux.HandleFunc("GET /photos/bucket/faces", handleSavedFaces(d.store.R2, storage.SavedFaces))
	mux.HandleFunc("POST /photos/bucket/faces/detect", handleDetectFaces(d.store.R2, storage.GetPhoto, versions.DetectFaces))
	mux.HandleFunc("GET /photos/original", handleOriginal(d.store.R2, storage.GetPhoto))
}
