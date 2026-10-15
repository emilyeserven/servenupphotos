package httpapi

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// maxSettingsBytes caps the size of a settings update body.
const maxSettingsBytes = 64 << 10

// connectionTestTimeout bounds how long a connection test waits on the remote
// service.
const connectionTestTimeout = 10 * time.Second

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

// handleTestSettings checks a settings update of type U against the remote
// service without saving it. resolve fills in stored secrets the update keeps.
// A failed check is still a 200: the result's message says what went wrong.
func handleTestSettings[U, S any](
	resolve func(U) (S, error),
	check func(context.Context, S) storage.CheckResult,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		update, ok := decodeSettings[U](w, r)
		if !ok {
			return
		}
		cfg, err := resolve(update)
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), connectionTestTimeout)
		defer cancel()
		writeJSON(w, http.StatusOK, check(ctx, cfg))
	}
}

// decodeSettings reads a settings body of type U, writing a 400 if it is invalid.
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
