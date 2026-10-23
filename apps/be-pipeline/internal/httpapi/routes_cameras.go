package httpapi

import "net/http"

// registerCameraRoutes adds the routes for camera overrides, combined into
// CAMERAS.json, and custom lenses, combined into LENSES.json.
func registerCameraRoutes(mux *http.ServeMux, d routeDeps) {
	mux.HandleFunc("PUT /cameras/{id}", handleSaveCameraOverride(d.store, d.gh))
	mux.HandleFunc("DELETE /cameras/{id}", handleDeleteCameraOverride(d.store, d.gh))
	mux.HandleFunc("PUT /lenses/{id}", handleSaveCustomLens(d.store, d.gh))
	mux.HandleFunc("DELETE /lenses/{id}", handleDeleteCustomLens(d.store, d.gh))
}
