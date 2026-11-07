package httpapi

import "net/http"

// registerPlacesRoutes adds the routes for places and localizations.
func registerPlacesRoutes(mux *http.ServeMux, d routeDeps) {
	mux.HandleFunc("GET /places", handleEntries(d.store, d.gh))
	mux.HandleFunc("PUT /places/{id}", handleSavePlace(d.store, d.gh))
	mux.HandleFunc("GET /places/{id}/area", handlePlaceArea(d.store, d.gh))
	mux.HandleFunc("PUT /places/{id}/area", handleSavePlaceArea(d.store, d.gh))
	mux.HandleFunc("DELETE /places/{id}/area", handleDeletePlaceArea(d.store, d.gh))
	mux.HandleFunc("PUT /localizations/{id}", handleSaveLocalization(d.store, d.gh))
}
