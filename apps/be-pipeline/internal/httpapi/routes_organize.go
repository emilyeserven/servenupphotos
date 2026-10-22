package httpapi

import "net/http"

// registerOrganizeRoutes adds the routes for albums and tags, and for adding photos to them.
func registerOrganizeRoutes(mux *http.ServeMux, d routeDeps) {
	mux.HandleFunc("GET /organize", handleOrganize(d.store, d.gh))
	mux.HandleFunc("POST /organize/{kind}", handleCreateGroup(d.store, d.gh))
	mux.HandleFunc("PUT /organize/albums/{id}/parent", handleSetAlbumParent(d.store, d.gh))
	mux.HandleFunc("POST /photos/groups", handleAddPhotoGroups(d.store, d.gh))
}
