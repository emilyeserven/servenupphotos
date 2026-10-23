package httpapi

import (
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// registerDataRoutes adds the Update Data routes: bulk changes to the photo JSON.
func registerDataRoutes(mux *http.ServeMux, d routeDeps) {
	mux.HandleFunc("POST /data/image-base-url/preview", handlePreviewBaseURL(d.store, d.gh))
	mux.HandleFunc("POST /data/image-base-url", handleReplaceBaseURL(d.store, d.gh))
	mux.HandleFunc("POST /data/camera-overrides/preview", handlePreviewReapplyOverrides(d.store, d.gh))
	mux.HandleFunc("POST /data/camera-overrides", handleReapplyOverrides(d.store, d.gh))
	exifs := newExifCache()
	mux.HandleFunc("POST /data/missing-fields/preview", handlePreviewBackfill(d.extractor, d.store, d.gh, storage.GetPhoto, storage.ThumbnailCrop, exifs))
	mux.HandleFunc("POST /data/missing-fields", handleApplyBackfill(d.extractor, d.store, d.gh, storage.GetPhoto, storage.ThumbnailCrop, exifs))
}
