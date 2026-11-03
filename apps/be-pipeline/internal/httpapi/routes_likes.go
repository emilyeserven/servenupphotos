package httpapi

import "net/http"

// registerLikesRoutes adds the routes for fan likes, one file per person,
// combined into LIKES.json.
func registerLikesRoutes(mux *http.ServeMux, d routeDeps) {
	mux.HandleFunc("PUT /likes/{id}", handleSaveFanLikes(d.store, d.gh))
	mux.HandleFunc("DELETE /likes/{id}", handleDeleteFanLikes(d.store, d.gh))
}
