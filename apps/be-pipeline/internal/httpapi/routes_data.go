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
	mux.HandleFunc("POST /data/location-names/preview", handlePreviewLocationNames(d.store, d.gh))
	mux.HandleFunc("POST /data/location-names", handleApplyLocationNames(d.store, d.gh))
	mux.HandleFunc("POST /data/image-names/preview", handlePreviewImageNames(d.store, d.gh, storage.ListImages))
	mux.HandleFunc("POST /data/image-names", handleRenameImages(d.store, d.gh, storage.ListImages, storage.CopyPhoto))
	mux.HandleFunc("POST /data/bulk-tags/untagged", handleCountUntaggedPhotos(d.store, d.gh))
	mux.HandleFunc("POST /data/bulk-tags/pick", handlePickBulkTagPhotos(d.store, d.gh))
	mux.HandleFunc("POST /data/bulk-tags/preview", handlePreviewBulkTags(d.store, d.gh))
	mux.HandleFunc("POST /data/bulk-tags", handleApplyBulkTags(d.store, d.gh))
	mux.HandleFunc("POST /data/bulk-places/pick", handlePickBulkPlacePhotos(d.store, d.gh))
	mux.HandleFunc("POST /data/bulk-places", handleApplyBulkPlaces(d.store, d.gh))
	mux.HandleFunc("POST /data/prune-tags/preview", handlePreviewPruneTags(d.store, d.gh))
	mux.HandleFunc("POST /data/prune-tags", handleApplyPruneTags(d.store, d.gh))
	mux.HandleFunc("POST /data/genre-suggestions/pick", handlePickGenrePhotos(d.store, d.gh))
	mux.HandleFunc("POST /data/genre-suggestions/preview", handlePreviewGenreSuggestions(d.store, d.gh))
	mux.HandleFunc("POST /data/genre-suggestions", handleApplyGenreSuggestions(d.store, d.gh))
	mux.HandleFunc("POST /data/album-suggestions/pick", handlePickAlbumPhotos(d.store, d.gh))
	mux.HandleFunc("POST /data/album-suggestions/preview", handlePreviewAlbumSuggestions(d.store, d.gh))
	mux.HandleFunc("POST /data/album-suggestions", handleApplyAlbumSuggestions(d.store, d.gh))
	exifs := newExifCache()
	progress := newReadProgress()
	mux.HandleFunc("GET /data/progress/{task}", handleReadProgress(progress))
	mux.HandleFunc("POST /data/missing-fields/preview", progress.tracked("missing-fields",
		handlePreviewBackfill(d.extractor, d.store, d.gh, storage.GetPhoto, storage.ThumbnailCrop, exifs)))
	mux.HandleFunc("POST /data/missing-fields", progress.tracked("missing-fields",
		handleApplyBackfill(d.extractor, d.store, d.gh, storage.GetPhoto, storage.ThumbnailCrop, exifs)))
	mux.HandleFunc("POST /data/colors/preview", progress.tracked("colors", handlePreviewColors(d.store, d.gh, storage.GetPhoto, d.colors)))
	mux.HandleFunc("POST /data/colors", progress.tracked("colors", handleWriteColors(d.store, d.gh, storage.GetPhoto, d.colors)))
}
