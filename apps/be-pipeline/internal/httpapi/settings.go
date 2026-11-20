package httpapi

import (
	"context"
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
		pub, ok := loadSettings(w, store.Get)
		if !ok {
			return
		}
		writeJSON(w, http.StatusOK, pub)
	}
}

// handleUpdateSettings decodes an update of type U and applies it with save.
func handleUpdateSettings[U any](save func(U) (settings.Public, error)) http.HandlerFunc {
	return withBody("settings", maxSettingsBytes, func(w http.ResponseWriter, _ *http.Request, update U) {
		pub, err := save(update)
		if err != nil {
			slog.Error("save settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "Couldn't save the settings. Check that the backend can write to its settings folder.")
			return
		}
		writeJSON(w, http.StatusOK, pub)
	})
}

// handleTestSettings checks a settings update of type U against the remote
// service without saving it. resolve fills in stored secrets the update keeps.
// A failed check is still a 200: the result's message says what went wrong.
func handleTestSettings[U, S any](
	resolve func(U) (S, error),
	check func(context.Context, S) storage.CheckResult,
) http.HandlerFunc {
	return withBody("settings", maxSettingsBytes, func(w http.ResponseWriter, r *http.Request, update U) {
		load := func() (S, error) { return resolve(update) }
		withSettings(load, connectionTestTimeout, func(ctx context.Context, w http.ResponseWriter, _ *http.Request, cfg S) {
			writeJSON(w, http.StatusOK, check(ctx, cfg))
		})(w, r)
	})
}
