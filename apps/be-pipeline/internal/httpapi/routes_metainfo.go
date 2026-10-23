package httpapi

import "net/http"

// registerMetaInfoRoutes adds the routes for metadata groups, combined into
// METAINFO.json.
func registerMetaInfoRoutes(mux *http.ServeMux, d routeDeps) {
	mux.HandleFunc("PUT /metainfo/{id}", handleSaveMetaGroup(d.store, d.gh))
	mux.HandleFunc("DELETE /metainfo/{id}", handleDeleteMetaGroup(d.store, d.gh))
}
