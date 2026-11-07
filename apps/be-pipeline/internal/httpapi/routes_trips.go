package httpapi

import "net/http"

// registerTripRoutes adds the routes for Trips, kept in the timeline folder
// and combined into TIMELINE.json.
func registerTripRoutes(mux *http.ServeMux, d routeDeps) {
	mux.HandleFunc("PUT /trips/{id}", handleSaveTrip(d.store, d.gh))
	mux.HandleFunc("DELETE /trips/{id}", handleDeleteTrip(d.store, d.gh))
}
