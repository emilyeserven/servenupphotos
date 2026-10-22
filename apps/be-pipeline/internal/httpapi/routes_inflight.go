package httpapi

import (
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// registerInFlightRoutes adds the routes for the photo data pull request's photos (Photos in Flight) and the photos already in the portfolio (Gallery).
func registerInFlightRoutes(mux *http.ServeMux, d routeDeps) {
	mux.HandleFunc("GET /photos/in-flight", handlePhotosInFlight(d.store, d.gh, storage.FindPhotos))
	mux.HandleFunc("GET /photos/in-flight/ci", handleCombineStatus(d.store, d.gh))
	mux.HandleFunc("DELETE /photos/in-flight", handleRemoveInFlight(d.store, d.gh, storage.FindPhotos, storage.DeletePhoto))
	mux.HandleFunc("PUT /photos/in-flight", handleUpdateInFlight(d.store, d.gh))
	mux.HandleFunc("GET /photos/published", handlePublishedPhotos(d.store, d.gh, storage.FindPhotos))
}
