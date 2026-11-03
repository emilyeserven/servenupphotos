package httpapi

import "net/http"

// registerLikesRoutes adds the routes for viewer likes, one file per person,
// combined into LIKES.json.
func registerLikesRoutes(mux *http.ServeMux, d routeDeps) {
	mux.HandleFunc("PUT /likes/{id}", handleSaveViewerLikes(d.store, d.gh))
	mux.HandleFunc("DELETE /likes/{id}", handleDeleteViewerLikes(d.store, d.gh))
}
