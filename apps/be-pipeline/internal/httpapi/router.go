// Package httpapi wires the be-pipeline HTTP routes.
package httpapi

import (
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/exif"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// NewRouter returns the HTTP handler for all be-pipeline routes. extractor may be
// nil, in which case POST /exif responds with colors only and a null "exif".
func NewRouter(extractor exif.Extractor, store *settings.Store) http.Handler {
	return newRouter(extractor, store, github.New())
}

// newRouter is NewRouter with the GitHub client injectable, so tests can point
// it at a fake GitHub.
func newRouter(extractor exif.Extractor, store *settings.Store, gh *github.Client) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("GET /hello", handleHello)
	mux.HandleFunc("POST /exif", handleExif(extractor))
	mux.HandleFunc("GET /settings", handleGetSettings(store))
	mux.HandleFunc("PUT /settings/r2", handleUpdateSettings(store.UpdateR2))
	mux.HandleFunc("POST /settings/r2/test", handleTestSettings(store.ResolveR2, storage.CheckR2))
	mux.HandleFunc("PUT /settings/github", handleUpdateSettings(store.UpdateGitHub))
	mux.HandleFunc("POST /settings/github/test", handleTestSettings(store.ResolveGitHub, gh.Check))
	mux.HandleFunc("POST /upload", handleUpload(store.R2, storage.UploadPhoto))
	mux.HandleFunc("POST /photos/versions/{version}", handleVersionPreview)
	mux.HandleFunc("POST /photos/github", handlePublishPhoto(store, gh))
	mux.HandleFunc("POST /photos/all-photos/check", handleAllPhotosCheck(store, gh))
	mux.HandleFunc("GET /photos/in-flight", handlePhotosInFlight(store, gh, storage.FindPhotos))
	mux.HandleFunc("GET /photos/in-flight/ci", handleCombineStatus(store, gh))
	mux.HandleFunc("DELETE /photos/in-flight", handleRemoveInFlight(store, gh, storage.FindPhotos, storage.DeletePhoto))
	mux.HandleFunc("GET /photos/bucket", handleBucketImages(store.R2, storage.ListImages))
	mux.HandleFunc("POST /photos/bucket/exif", handleBucketExif(extractor, store.R2, storage.GetPhoto))
	mux.HandleFunc("GET /photos/combined", handleCombined(store, gh))
	mux.HandleFunc("POST /photos/bucket/versions", handleRegenerateVersions(store.R2, storage.RegenerateVersions))
	mux.HandleFunc("GET /photos/bucket/thumbnail-crop", handleThumbnailCrop(store.R2, storage.ThumbnailCrop))
	mux.HandleFunc("PUT /photos/in-flight", handleUpdateInFlight(store, gh))
	mux.HandleFunc("GET /photos/published", handlePublishedPhotos(store, gh, storage.FindPhotos))
	mux.HandleFunc("GET /organize", handleOrganize(store, gh))
	mux.HandleFunc("POST /organize/{kind}", handleCreateGroup(store, gh))
	mux.HandleFunc("POST /data/image-base-url/preview", handlePreviewBaseURL(store, gh))
	mux.HandleFunc("POST /data/image-base-url", handleReplaceBaseURL(store, gh))
	exifs := newExifCache()
	mux.HandleFunc("POST /data/missing-fields/preview", handlePreviewBackfill(extractor, store, gh, storage.GetPhoto, storage.ThumbnailCrop, exifs))
	mux.HandleFunc("POST /data/missing-fields", handleApplyBackfill(extractor, store, gh, storage.GetPhoto, storage.ThumbnailCrop, exifs))
	mux.HandleFunc("GET /publish/instagram", handleSocialCalendar(store, gh))
	mux.HandleFunc("PUT /publish/instagram", handleSetSocialDates(store, gh))
	return mux
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func handleHello(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"message": "Hello from be-pipeline (Go)"})
}
