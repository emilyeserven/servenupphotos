package httpapi

import "net/http"

// registerOrganizeRoutes adds the routes for albums and tags, their order and their photos' order, spotlight spots, tag names and descriptions, and for adding photos to them.
func registerOrganizeRoutes(mux *http.ServeMux, d routeDeps) {
	mux.HandleFunc("GET /organize", handleOrganize(d.store, d.gh))
	mux.HandleFunc("POST /organize/{kind}", handleCreateGroup(d.store, d.gh))
	mux.HandleFunc("PUT /organize/{kind}/{id}/parent", handleSetGroupParent(d.store, d.gh))
	mux.HandleFunc("PUT /organize/albums/order", handleSetAlbumOrder(d.store, d.gh))
	mux.HandleFunc("PUT /organize/albums/{id}/photo-order", handleSetAlbumPhotoOrder(d.store, d.gh))
	mux.HandleFunc("PUT /organize/tags/names", handleNormalizeTagNames(d.store, d.gh))
	mux.HandleFunc("PUT /organize/tags/descriptions", handleSetTagDescriptions(d.store, d.gh))
	mux.HandleFunc("PUT /organize/spotlight/{zone}", handleSetSpotlightAlbum(d.store, d.gh))
	mux.HandleFunc("POST /photos/groups", handleAddPhotoGroups(d.store, d.gh))
}
