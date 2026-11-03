package httpapi

import "net/http"

// registerTimelineRoutes adds the routes for timeline labels, combined into
// TIMELINE.json.
func registerTimelineRoutes(mux *http.ServeMux, d routeDeps) {
	mux.HandleFunc("PUT /timeline/{id}", handleSaveTimelineLabel(d.store, d.gh))
	mux.HandleFunc("DELETE /timeline/{id}", handleDeleteTimelineLabel(d.store, d.gh))
}
