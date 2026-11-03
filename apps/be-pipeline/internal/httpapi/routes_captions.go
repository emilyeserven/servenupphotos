package httpapi

import "net/http"

// registerCaptionRoutes adds the routes for caption templates, combined into
// CAPTIONS.json.
func registerCaptionRoutes(mux *http.ServeMux, d routeDeps) {
	mux.HandleFunc("PUT /captions/{id}", handleSaveCaptionTemplate(d.store, d.gh))
	mux.HandleFunc("DELETE /captions/{id}", handleDeleteCaptionTemplate(d.store, d.gh))
}
