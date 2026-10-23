package httpapi

import "net/http"

// registerCameraRoutes adds the routes for camera overrides, combined into
// CAMERAS.json.
func registerCameraRoutes(mux *http.ServeMux, d routeDeps) {
	mux.HandleFunc("PUT /cameras/{id}", handleSaveCameraOverride(d.store, d.gh))
	mux.HandleFunc("DELETE /cameras/{id}", handleDeleteCameraOverride(d.store, d.gh))
}
