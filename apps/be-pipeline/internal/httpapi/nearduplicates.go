package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/gen2brain/webp"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/phash"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// nearDuplicatesTimeout bounds finding near duplicates, which may download
// the Small version of every photo without a perceptual hash from R2.
const nearDuplicatesTimeout = 5 * time.Minute

// publishHashTimeout bounds reading a photo's perceptual hash before a
// publish, which downloads its Small version from R2 when the offline copy
// doesn't have it yet.
const publishHashTimeout = 10 * time.Second

// hashCache keeps the perceptual hash of Small versions in R2 by URL.
type hashCache = keyCache[string]

// smallFileFunc is the path on disk of the Small version at a URL,
// downloaded from R2 first when needed; the offline copy's Thumbnail in
// production.
type smallFileFunc func(ctx context.Context, cfg settings.R2, url string) (string, error)

// hashReader reads the perceptual hash of a photo's Small version, kept on
// disk by the offline copy, through cache.
func hashReader(r2 func() (settings.R2, error), file smallFileFunc, cache *hashCache) github.HashReader {
	return func(ctx context.Context, url string) (string, string) {
		if h, ok := cache.get(url); ok {
			return h, ""
		}
		cfg, err := r2()
		if err != nil {
			return "", "Couldn't read the R2 settings."
		}
		path, err := file(ctx, cfg, url)
		if err != nil {
			return "", "Couldn't download its Small version from R2."
		}
		h, err := hashFile(path)
		if err != nil {
			slog.Warn("perceptual hash failed", "url", url, "err", err)
			return "", "Couldn't read its Small version."
		}
		cache.put(url, h)
		return h, ""
	}
}

// hashFile is the perceptual hash of the WEBP at path.
func hashFile(path string) (string, error) {
	f, err := os.Open(path) //nolint:gosec // a file the offline copy names
	if err != nil {
		return "", err
	}
	defer f.Close() //nolint:errcheck // read-only
	img, err := webp.Decode(f)
	if err != nil {
		return "", err
	}
	return phash.Format(phash.Of(img)), nil
}

// photoHash reads the perceptual hash of the Small version at small, or nil
// when there's none or it can't be read, so the photo is saved without one
// and isn't checked for near duplicates; Find near duplicates adds it later.
func photoHash(ctx context.Context, read github.HashReader, small *string) *string {
	if small == nil || *small == "" {
		return nil
	}
	ctx, cancel := context.WithTimeout(ctx, publishHashTimeout)
	defer cancel()
	h, msg := read(ctx, *small)
	if msg != "" {
		slog.Warn("could not read the photo's perceptual hash", "url", *small, "reason", msg)
		return nil
	}
	return &h
}

// handleFindNearDuplicates gives every photo without a perceptual hash one
// and puts each set of photos that look nearly the same in a compare group,
// as changes waiting for Commit.
func handleFindNearDuplicates(store *settings.Store, gh *github.Client, read github.HashReader) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, err := store.GitHub()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), nearDuplicatesTimeout)
		defer cancel()
		result, err := gh.FindNearDuplicates(ctx, cfg, read)
		var perr *github.PublishError
		if errors.As(err, &perr) {
			writePublishError(w, perr)
			return
		}
		if err != nil {
			slog.Error("find near duplicates failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not look for near duplicates")
			return
		}
		writeJSON(w, http.StatusOK, result)
	}
}
