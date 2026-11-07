package httpapi

import "net/http"

// registerGraphRoutes adds the routes for the Graph page's presets and preset
// groups, combined into GRAPHS.json.
func registerGraphRoutes(mux *http.ServeMux, d routeDeps) {
	mux.HandleFunc("PUT /graphs/{id}", handleSaveGraphPreset(d.store, d.gh))
	mux.HandleFunc("DELETE /graphs/{id}", handleDeleteGraphPreset(d.store, d.gh))
}
