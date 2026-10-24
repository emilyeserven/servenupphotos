// Package httpapi wires the be-pipeline HTTP routes.
package httpapi

import (
	"net/http"
	"path/filepath"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/colors"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/exif"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// NewRouter returns the HTTP handler for all be-pipeline routes. extractor may be
// nil, in which case POST /exif responds with colors only and a null "exif".
// The changes saved and not committed yet are kept in pending-changes.json
// next to the settings.
func NewRouter(extractor exif.Extractor, store *settings.Store) http.Handler {
	stage := github.NewStage("")
	local := github.NewLocalCopy("")
	if store != nil {
		stage = github.NewStage(filepath.Join(store.Dir(), "pending-changes.json"))
		local = github.NewLocalCopy(filepath.Join(store.Dir(), "github-cache.json"))
	}
	gh := github.New(stage)
	gh.Local = local
	return newRouter(extractor, store, gh)
}

// routeDeps is what the route handlers are built from.
type routeDeps struct {
	extractor exif.Extractor
	store     *settings.Store
	gh        *github.Client
	// colors keeps the color summary of originals in R2 by key, filled
	// when a photo is uploaded and read when its JSON is saved or Update
	// Data reads colors.
	colors *colorCache
}

// newRouter is NewRouter with the GitHub client injectable, so tests can point
// it at a fake GitHub. Each area's routes are listed in its routes_*.go file.
func newRouter(extractor exif.Extractor, store *settings.Store, gh *github.Client) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("GET /hello", handleHello)
	mux.HandleFunc("POST /exif", handleExif(extractor, cameraOverrides(store, gh)))
	d := routeDeps{extractor: extractor, store: store, gh: gh, colors: newKeyCache[colors.Summary]()}
	registerSettingsRoutes(mux, d)
	registerPhotoRoutes(mux, d)
	registerInFlightRoutes(mux, d)
	registerBucketRoutes(mux, d)
	registerOrganizeRoutes(mux, d)
	registerPlacesRoutes(mux, d)
	registerMetaInfoRoutes(mux, d)
	registerCameraRoutes(mux, d)
	registerDataRoutes(mux, d)
	registerPublishRoutes(mux, d)
	return mux
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func handleHello(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"message": "Hello from be-pipeline (Go)"})
}
