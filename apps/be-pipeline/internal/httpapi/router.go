// Package httpapi wires the be-pipeline HTTP routes.
package httpapi

import (
	"context"
	"net/http"
	"path/filepath"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/colors"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/exif"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/offline"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// NewRouter returns the HTTP handler for all be-pipeline routes. extractor may be
// nil, in which case POST /exif responds with colors only and a null "exif".
// The changes saved and not committed yet are kept in pending-changes.json
// next to the settings.
func NewRouter(extractor exif.Extractor, store *settings.Store) http.Handler {
	return NewPipeline(extractor, store, "").Handler
}

// Pipeline is the backend's routes and the work it does when it starts.
type Pipeline struct {
	// Handler answers every be-pipeline route.
	Handler http.Handler
	// WarmOffline downloads the Square Thumbnails the Gallery and Photos in
	// Flight show that the offline copy doesn't have yet. It's run once at
	// start-up, in the background.
	WarmOffline func(ctx context.Context)
}

// NewPipeline is NewRouter with the start-up work that goes with it, and the
// photo data files in checkout, a copy of the repository on disk, reused
// instead of downloaded from GitHub when they match (see
// github.Client.Checkout); "" uses none. The offline copy of the thumbnails
// is kept in the settings folder.
func NewPipeline(extractor exif.Extractor, store *settings.Store, checkout string) *Pipeline {
	gh := newGitHub(store, checkout)
	d := newRouteDeps(extractor, store, gh)
	return &Pipeline{
		Handler:     routes(d),
		WarmOffline: func(ctx context.Context) { warmOffline(ctx, d) },
	}
}

// newGitHub is the GitHub client with its stage and local copy kept next to
// the settings, and the photo data in checkout reused.
func newGitHub(store *settings.Store, checkout string) *github.Client {
	stage := github.NewStage("")
	local := github.NewLocalCopy("")
	if store != nil {
		stage = github.NewStage(filepath.Join(store.Dir(), "pending-changes.json"))
		local = github.NewLocalCopy(filepath.Join(store.Dir(), "github-cache.json"))
	}
	gh := github.New(stage)
	gh.Local = local
	gh.Checkout = checkout
	return gh
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
	// offline keeps the thumbnails and the images found in R2 for when the
	// internet can't be reached, in the settings folder.
	offline *offline.Copy
	// findPhotos looks for the photos' images in R2, falling back to the
	// offline copy when R2 can't be reached.
	findPhotos findPhotosFunc
}

// newRouteDeps is what the routes are built from, with the offline copy in
// the settings folder (none without a store).
func newRouteDeps(extractor exif.Extractor, store *settings.Store, gh *github.Client) routeDeps {
	dir := ""
	if store != nil {
		dir = filepath.Join(store.Dir(), "offline")
	}
	kept := offline.New(dir, storage.GetThumbnail)
	return routeDeps{
		extractor:  extractor,
		store:      store,
		gh:         gh,
		colors:     newKeyCache[colors.Summary](),
		offline:    kept,
		findPhotos: findPhotosFunc(kept.Find(storage.FindPhotos)),
	}
}

// newRouter is NewRouter with the GitHub client injectable, so tests can point
// it at a fake GitHub. Each area's routes are listed in its routes_*.go file.
func newRouter(extractor exif.Extractor, store *settings.Store, gh *github.Client) http.Handler {
	return routes(newRouteDeps(extractor, store, gh))
}

// routes is every route, built from d.
func routes(d routeDeps) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("GET /hello", handleHello)
	mux.HandleFunc("POST /exif", handleExif(d.extractor, cameraOverrides(d.store, d.gh)))
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
	registerOfflineRoutes(mux, d)
	return mux
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func handleHello(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"message": "Hello from be-pipeline (Go)"})
}
