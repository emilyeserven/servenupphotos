package httpapi

import "net/http"

// registerTripLineRoutes adds the routes for the days' trip lines, combined
// into TRIPLINES.json and baked into TRIPLINES.geo.json for the portfolio's
// map.
func registerTripLineRoutes(mux *http.ServeMux, d routeDeps) {
	mux.HandleFunc("GET /triplines/{day}/auto", handleAutoTripLine(d.store, d.gh))
	mux.HandleFunc("PUT /triplines/{day}", handleSaveTripLine(d.store, d.gh))
	mux.HandleFunc("POST /triplines/{day}/route", handleRouteTripLine(d.store, d.gh, d.route))
	mux.HandleFunc("DELETE /triplines/{day}", handleDeleteTripLine(d.store, d.gh))
	mux.HandleFunc("PUT /tripstories/{id}", handleSaveTripStory(d.store, d.gh))
	mux.HandleFunc("DELETE /tripstories/{id}", handleDeleteTripStory(d.store, d.gh))
	mux.HandleFunc("GET /transit/lines", handleTransitLines(d.transit))
	mux.HandleFunc("GET /transit/lines/{id}/track", handleTransitTrack(d.transit))
	mux.HandleFunc("GET /transit/lines/{id}/stops", handleTransitStops(d.transit))
	mux.HandleFunc("GET /transit/stations", handleTransitStations(d.transit))
	mux.HandleFunc("GET /areas", handleFindAreas(d.areas))
}
