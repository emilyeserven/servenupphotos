package httpapi

import "net/http"

// registerPublishRoutes adds the Publish routes: the Instagram calendar and its
// Not Stored posts, combined into NOTSTORED.json, and the Dashboard's Needs
// attention, which reads the same files cut down.
func registerPublishRoutes(mux *http.ServeMux, d routeDeps) {
	mux.HandleFunc("GET /publish/instagram", handleSocialCalendar(d.store, d.gh))
	mux.HandleFunc("PUT /publish/instagram", handleSetSocialDates(d.store, d.gh))
	mux.HandleFunc("PUT /notstored/{day}", handleSaveNotStoredPost(d.store, d.gh))
	mux.HandleFunc("DELETE /notstored/{day}", handleDeleteNotStoredPost(d.store, d.gh))
	mux.HandleFunc("GET /attention", handleAttention(d.store, d.gh))
}
