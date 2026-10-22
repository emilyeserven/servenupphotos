package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/exif"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// backfillTimeout bounds adding missing fields, which can download many
// originals from R2 to read their EXIF.
const backfillTimeout = 3 * time.Minute

// maxCachedExif caps how many originals' EXIF exifCache keeps.
const maxCachedExif = 2000

type backfillRequest struct {
	// ReadExif fills missing EXIF fields from the originals in R2.
	ReadExif bool `json:"readExif"`
}

// exifCache keeps the sanitized EXIF of originals in R2 by key, so applying
// a backfill doesn't download every original its preview just read. An
// uploaded original's key never points at another photo.
type exifCache struct {
	mu    sync.Mutex
	byKey map[string]exif.Sanitized
}

func newExifCache() *exifCache { return &exifCache{byKey: map[string]exif.Sanitized{}} }

func (c *exifCache) get(key string) (exif.Sanitized, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	s, ok := c.byKey[key]
	return s, ok
}

func (c *exifCache) put(key string, s exif.Sanitized) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.byKey) >= maxCachedExif {
		clear(c.byKey)
	}
	c.byKey[key] = s
}

// handlePreviewBackfill lists the fields each photo JSON file is missing,
// as the Update Data page previews adding them.
func handlePreviewBackfill(extractor exif.Extractor, store *settings.Store, gh *github.Client, get getPhotoFunc, cache *exifCache) http.HandlerFunc {
	return handleBackfill(extractor, store, get, cache, func(ctx context.Context, cfg settings.GitHub, read github.ExifReader) (any, error) {
		return gh.PreviewBackfill(ctx, cfg, read)
	})
}

// handleApplyBackfill adds the missing fields to every photo JSON file, as one
// commit in the photo data pull request.
func handleApplyBackfill(extractor exif.Extractor, store *settings.Store, gh *github.Client, get getPhotoFunc, cache *exifCache) http.HandlerFunc {
	return handleBackfill(extractor, store, get, cache, func(ctx context.Context, cfg settings.GitHub, read github.ExifReader) (any, error) {
		return gh.Backfill(ctx, cfg, read)
	})
}

func handleBackfill(
	extractor exif.Extractor, store *settings.Store, get getPhotoFunc, cache *exifCache,
	run func(context.Context, settings.GitHub, github.ExifReader) (any, error),
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req backfillRequest
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxPhotoDataBytes)).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid backfill body")
			return
		}
		cfg, err := store.GitHub()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}
		var read github.ExifReader
		if req.ReadExif && extractor != nil {
			read = exifReader(extractor, store.R2, get, cache)
		}

		ctx, cancel := context.WithTimeout(r.Context(), backfillTimeout)
		defer cancel()
		result, err := run(ctx, cfg, read)
		var perr *github.PublishError
		if errors.As(err, &perr) {
			writeError(w, perr.Status, perr.Message)
			return
		}
		if err != nil {
			slog.Error("add missing photo fields failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not add the missing fields")
			return
		}
		writeJSON(w, http.StatusOK, result)
	}
}

// exifReader reads an original's EXIF from R2 as POST /photos/bucket/exif
// does, through cache.
func exifReader(extractor exif.Extractor, r2 func() (settings.R2, error), get getPhotoFunc, cache *exifCache) github.ExifReader {
	return func(ctx context.Context, key string) (exif.Sanitized, string) {
		if s, ok := cache.get(key); ok {
			return s, ""
		}
		cfg, err := r2()
		if err != nil {
			return exif.Sanitized{}, "Couldn't read the R2 settings."
		}
		path, status, msg := downloadPhoto(ctx, cfg, get, key)
		if status != http.StatusOK {
			return exif.Sanitized{}, msg
		}
		defer os.Remove(path) //nolint:errcheck // best-effort cleanup
		fields, err := extractor.Extract(path)
		if err != nil {
			slog.Error("exif extraction failed", "key", key, "err", err)
			return exif.Sanitized{}, "Couldn't read the photo's EXIF."
		}
		s := exif.Sanitize(fields)
		cache.put(key, s)
		return s, ""
	}
}
