package httpapi

import (
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// registerPhotoRoutes adds the Photo page's routes: previewing versions, uploading to R2, saving the photo's JSON to the photo data pull request, and reading, checking and committing the combined lists, and discarding, exporting and importing pending changes.
func registerPhotoRoutes(mux *http.ServeMux, d routeDeps) {
	mux.HandleFunc("POST /upload", handleUpload(d.store.R2, storage.UploadPhoto, d.colors))
	mux.HandleFunc("POST /photos/versions/{version}", handleVersionPreview)
	mux.HandleFunc("POST /photos/github", handlePublishPhoto(d.store, d.gh, colorReader(d.store.R2, storage.GetPhoto, d.colors)))
	mux.HandleFunc("POST /photos/all-photos/check", handleAllPhotosCheck(d.store, d.gh))
	mux.HandleFunc("GET /photos/combined", handleCombined(d.store, d.gh))
	mux.HandleFunc("GET /photos/combined/status", handleCombinedStatus(d.store, d.gh))
	mux.HandleFunc("POST /photos/combined", handleCommitCombined(d.store, d.gh))
	mux.HandleFunc("DELETE /photos/pending", handleDiscardPending(d.store, d.gh))
	mux.HandleFunc("GET /photos/pending", handleExportPending(d.store, d.gh))
	mux.HandleFunc("POST /photos/pending", handleImportPending(d.store, d.gh))
}
