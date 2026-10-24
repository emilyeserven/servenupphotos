package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/colors"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// colorsTimeout bounds adding color data, which downloads the original of
// every photo without it from R2.
const colorsTimeout = 5 * time.Minute

type colorsRequest struct {
	// Recompute reads the colors of photos that already have them again.
	Recompute bool `json:"recompute"`
}

// colorCache keeps the color summary of originals in R2 by key.
type colorCache = keyCache[colors.Summary]

// handlePreviewColors reads the colors of each photo without them from its
// original in R2, as the Update Data page previews adding them.
func handlePreviewColors(store *settings.Store, gh *github.Client, get getPhotoFunc, cache *colorCache) http.HandlerFunc {
	return handleColors(store, get, cache, func(ctx context.Context, cfg settings.GitHub, read github.ColorReader, recompute bool) (any, error) {
		return gh.PreviewColors(ctx, cfg, read, recompute)
	})
}

// handleWriteColors saves those colors in each photo JSON file, as changes
// waiting for Commit.
func handleWriteColors(store *settings.Store, gh *github.Client, get getPhotoFunc, cache *colorCache) http.HandlerFunc {
	return handleColors(store, get, cache, func(ctx context.Context, cfg settings.GitHub, read github.ColorReader, recompute bool) (any, error) {
		return gh.WriteColors(ctx, cfg, read, recompute)
	})
}

func handleColors(
	store *settings.Store, get getPhotoFunc, cache *colorCache,
	run func(context.Context, settings.GitHub, github.ColorReader, bool) (any, error),
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req colorsRequest
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxPhotoDataBytes)).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid colors body")
			return
		}
		cfg, err := store.GitHub()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), colorsTimeout)
		defer cancel()
		result, err := run(ctx, cfg, colorReader(store.R2, get, cache), req.Recompute)
		var perr *github.PublishError
		if errors.As(err, &perr) {
			writePublishError(w, perr)
			return
		}
		if err != nil {
			slog.Error("add photo colors failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not add the color data")
			return
		}
		writeJSON(w, http.StatusOK, result)
	}
}

// colorReader reads an original's colors from R2 as POST /exif reads an
// upload's, through cache.
func colorReader(r2 func() (settings.R2, error), get getPhotoFunc, cache *colorCache) github.ColorReader {
	return func(ctx context.Context, key string) (colors.Summary, string) {
		if s, ok := cache.get(key); ok {
			return s, ""
		}
		cfg, err := r2()
		if err != nil {
			return colors.Summary{}, "Couldn't read the R2 settings."
		}
		path, status, msg := downloadPhoto(ctx, cfg, get, key)
		if status != http.StatusOK {
			return colors.Summary{}, msg
		}
		defer os.Remove(path) //nolint:errcheck // best-effort cleanup
		analysis, err := analyzeColors(path)
		if err != nil {
			slog.Error("color analysis failed", "key", key, "err", err)
			return colors.Summary{}, "Couldn't read the photo's colors."
		}
		cache.put(key, analysis.Summary)
		return analysis.Summary, ""
	}
}
