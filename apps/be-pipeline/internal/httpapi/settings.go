package httpapi

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/githubcheck"
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

// handleTestSettings decodes an update of type U, the same body a save takes,
// resolves it against the stored secret, and tests the connection. Nothing is
// saved. A failed connection is still a 200; its result says why it failed.
func handleTestSettings[U, S any](
	resolve func(U) (S, error),
	test func(context.Context, S) githubcheck.Result,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		update, ok := decodeSettings[U](w, r)
		if !ok {
			return
		}
		resolved, err := resolve(update)
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}
		writeJSON(w, http.StatusOK, test(r.Context(), resolved))
	}
}

// handleUpdateSettings decodes an update of type U and applies it with save.
func handleUpdateSettings[U any](save func(U) (settings.Public, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		update, ok := decodeSettings[U](w, r)
		if !ok {
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

// decodeSettings decodes a settings body of type U, or responds 400 and
// reports false.
func decodeSettings[U any](w http.ResponseWriter, r *http.Request) (U, bool) {
	var update U
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxSettingsBytes))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&update); err != nil {
		writeError(w, http.StatusBadRequest, "invalid settings body")
		return update, false
	}
	return update, true
}
