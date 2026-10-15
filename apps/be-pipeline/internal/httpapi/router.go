// Package httpapi wires the be-pipeline HTTP routes.
package httpapi

import (
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/exif"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/githubcheck"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// NewRouter returns the HTTP handler for all be-pipeline routes. extractor may be
// nil, in which case POST /exif responds with colors only and a null "exif".
func NewRouter(extractor exif.Extractor, store *settings.Store) http.Handler {
	return newRouter(extractor, store, githubcheck.New())
}

// newRouter is NewRouter with the GitHub checker injectable, so tests can point
// it at a fake GitHub.
func newRouter(extractor exif.Extractor, store *settings.Store, github *githubcheck.Checker) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("GET /hello", handleHello)
	mux.HandleFunc("POST /exif", handleExif(extractor))
	mux.HandleFunc("GET /settings", handleGetSettings(store))
	mux.HandleFunc("PUT /settings/r2", handleUpdateSettings(store.UpdateR2))
	mux.HandleFunc("POST /settings/r2/test", handleTestSettings(store.ResolveR2, storage.CheckR2))
	mux.HandleFunc("PUT /settings/github", handleUpdateSettings(store.UpdateGitHub))
	mux.HandleFunc("POST /settings/github/test", handleTestSettings(store.ResolveGitHub, github.Check))
	mux.HandleFunc("POST /upload", handleUpload(store.R2, storage.UploadPhoto))
	return mux
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func handleHello(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"message": "Hello from be-pipeline (Go)"})
}
