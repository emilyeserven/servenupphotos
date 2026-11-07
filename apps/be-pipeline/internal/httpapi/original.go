package httpapi

import (
	"context"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// originalTimeout bounds downloading one original JPEG from R2 to pass on.
const originalTimeout = 60 * time.Second

// handleOriginal sends the original JPEG at ?key= in R2 as a download, named
// ?name= when that's a JPEG file name (the photo's own, such as DSCF4800.jpg),
// or else the name its key keeps. The Instagram Planned page links to it, so a
// browser saves the file rather than opening it from R2's address.
func handleOriginal(r2 func() (settings.R2, error), get getPhotoFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		key := r.URL.Query().Get("key")
		if key == "" {
			writeError(w, http.StatusBadRequest, `expected the photo's R2 key as "key"`)
			return
		}
		cfg, err := r2()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), originalTimeout)
		defer cancel()
		photo, err := get(ctx, cfg, key)
		if err != nil {
			status, msg := getPhotoError(err)
			writeError(w, status, msg)
			return
		}
		defer photo.Close() //nolint:errcheck // read-only

		w.Header().Set("Content-Type", "image/jpeg")
		w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{
			"filename": downloadName(r.URL.Query().Get("name"), key),
		}))
		if _, err := io.Copy(w, io.LimitReader(photo, maxUploadBytes)); err != nil {
			slog.Warn("sending original failed", "key", key, "err", err)
		}
	}
}

// downloadName is name when it's a plain JPEG file name, or else the name key
// keeps, as storage.OriginalName gives it.
func downloadName(name, key string) string {
	ext := strings.ToLower(path.Ext(name))
	if name != "" && path.Base(name) == name && !strings.ContainsAny(name, `\"`) && (ext == ".jpg" || ext == ".jpeg") {
		return name
	}
	return storage.OriginalName(key)
}
