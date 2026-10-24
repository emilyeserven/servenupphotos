package httpapi

import (
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// registerBucketRoutes adds the Explore Bucket and Manage Sizes routes: what's in R2, deleting from it, and remaking versions.
func registerBucketRoutes(mux *http.ServeMux, d routeDeps) {
	mux.HandleFunc("GET /photos/bucket", handleBucketImages(d.store.R2, storage.ListImages))
	mux.HandleFunc("POST /photos/bucket/exif", handleBucketExif(d.extractor, d.store.R2, storage.GetPhoto, cameraOverrides(d.store, d.gh)))
	mux.HandleFunc("POST /photos/bucket/delete", handleDeleteBucketImages(d.store.R2, storage.DeleteImage))
	mux.HandleFunc("POST /photos/bucket/versions", handleRegenerateVersions(d.store.R2, storage.RegenerateVersions))
	mux.HandleFunc("GET /photos/bucket/thumbnail-crop", handleThumbnailCrop(d.store.R2, storage.ThumbnailCrop))
}
