package httpapi

import "net/http"

// registerOrganizeRoutes adds the routes for albums and tags, their order, deleting an album and removing its photos, their photos' order, covers, layout, visibility and Smart Album rules, spotlight spots, tag names, descriptions and favorites, the genres' order, names and subgenres, for adding photos to them, and the Photo Sets, combined into SETS.json.
func registerOrganizeRoutes(mux *http.ServeMux, d routeDeps) {
	mux.HandleFunc("GET /organize", handleOrganize(d.store, d.gh))
	mux.HandleFunc("POST /organize/{kind}", handleCreateGroup(d.store, d.gh))
	mux.HandleFunc("PUT /organize/{kind}/{id}/parent", handleSetGroupParent(d.store, d.gh))
	mux.HandleFunc("PUT /organize/albums/order", handleSetAlbumOrder(d.store, d.gh))
	mux.HandleFunc("PUT /organize/albums/{id}/photo-order", handleSetAlbumPhotoOrder(d.store, d.gh))
	mux.HandleFunc("PUT /organize/albums/{id}/layout", handleSetAlbumLayout(d.store, d.gh))
	mux.HandleFunc("DELETE /organize/albums/{id}", handleDeleteAlbum(d.store, d.gh))
	mux.HandleFunc("DELETE /organize/albums/{id}/photos", handleRemoveAlbumPhotos(d.store, d.gh))
	mux.HandleFunc("PUT /organize/albums/{id}/visibility", handleSetAlbumHidden(d.store, d.gh))
	mux.HandleFunc("PUT /organize/albums/{id}/rules", handleSetAlbumRules(d.store, d.gh))
	mux.HandleFunc("PUT /organize/genres/tree", handleSetGenreTree(d.store, d.gh))
	mux.HandleFunc("PUT /organize/tags/names", handleNormalizeTagNames(d.store, d.gh))
	mux.HandleFunc("PUT /organize/tags/descriptions", handleSetTagDescriptions(d.store, d.gh))
	mux.HandleFunc("PUT /organize/tags/favorites", handleSetTagFavorites(d.store, d.gh))
	mux.HandleFunc("PUT /organize/spotlight/{zone}", handleSetSpotlightAlbum(d.store, d.gh))
	mux.HandleFunc("POST /photos/groups", handleAddPhotoGroups(d.store, d.gh))
	mux.HandleFunc("PUT /sets/{id}", handleSavePhotoSet(d.store, d.gh))
	mux.HandleFunc("DELETE /sets/{id}", handleDeletePhotoSet(d.store, d.gh))
}
