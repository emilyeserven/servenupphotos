package httpapi

import (
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// registerSettingsRoutes adds the Settings routes: reading and saving them, and checking them against R2 and GitHub.
func registerSettingsRoutes(mux *http.ServeMux, d routeDeps) {
	mux.HandleFunc("GET /settings", handleGetSettings(d.store))
	mux.HandleFunc("PUT /settings/r2", handleUpdateSettings(d.store.UpdateR2))
	mux.HandleFunc("POST /settings/r2/test", handleTestSettings(d.store.ResolveR2, storage.CheckR2))
	mux.HandleFunc("PUT /settings/github", handleUpdateSettings(d.store.UpdateGitHub))
	mux.HandleFunc("POST /settings/github/test", handleTestSettings(d.store.ResolveGitHub, d.gh.Check))
}
