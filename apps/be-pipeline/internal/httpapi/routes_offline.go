package httpapi

import "net/http"

// registerOfflineRoutes adds the route that serves the Square Thumbnails kept for offline use.
func registerOfflineRoutes(mux *http.ServeMux, d routeDeps) {
	mux.HandleFunc("GET /thumbnails", handleThumbnail(d.store, d.offline))
}
