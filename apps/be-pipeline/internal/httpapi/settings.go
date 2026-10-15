package httpapi

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// maxSettingsBytes caps the size of a settings update body.
const maxSettingsBytes = 64 << 10

// handleGetSettings responds with the stored settings. Secrets are reported
// only as set / not set, never returned.
func handleGetSettings(store *settings.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		pub, err := store.Get()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}
		writeJSON(w, http.StatusOK, pub)
	}
}

// handleUpdateSettings decodes an update of type U and applies it with save.
func handleUpdateSettings[U any](save func(U) (settings.Public, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var update U
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxSettingsBytes))
		dec.DisallowUnknownFields()
		if err := dec.Decode(&update); err != nil {
			writeError(w, http.StatusBadRequest, "invalid settings body")
			return
		}
		pub, err := save(update)
		if err != nil {
			slog.Error("save settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not save settings")
			return
		}
		writeJSON(w, http.StatusOK, pub)
	}
}
