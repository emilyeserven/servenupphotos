package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/offline"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// thumbnailTimeout bounds downloading one thumbnail the offline copy doesn't have yet.
const thumbnailTimeout = 20 * time.Second

// warmTimeout bounds the start-up download of the thumbnails the offline copy is missing.
const warmTimeout = 15 * time.Minute

// handleThumbnail serves the Square Thumbnail, Thumbnail Preview, Small or
// X-Small version at ?url=,
// its R2 URL, from the offline copy, downloading it from R2 first when the
// copy doesn't have it yet. So pages show it whether or not the internet can
// be reached, once it has been downloaded.
func handleThumbnail(store *settings.Store, kept *offline.Copy) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		raw := r.URL.Query().Get("url")
		cfg, err := store.R2()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), thumbnailTimeout)
		defer cancel()
		path, err := kept.Thumbnail(ctx, cfg, raw)
		if err != nil {
			writeThumbnailError(w, err)
			return
		}
		w.Header().Set("Content-Type", "image/webp")
		// A remade Square Thumbnail gets a new URL (its crop mark), so a day is safe.
		w.Header().Set("Cache-Control", "private, max-age=86400")
		http.ServeFile(w, r, path) //nolint:gosec // a file in the offline folder, named from a key IsThumbnailKey allowed and a hash
	}
}

// writeThumbnailError says why a thumbnail couldn't be served.
func writeThumbnailError(w http.ResponseWriter, err error) {
	var gerr *storage.GetError
	switch {
	case errors.Is(err, offline.ErrNotThumbnail):
		writeError(w, http.StatusBadRequest, "Only Square Thumbnails, Thumbnail Previews, Small and X-Small versions in R2 are kept offline.")
	case errors.As(err, &gerr) && gerr.NotFound:
		writeError(w, http.StatusNotFound, "That thumbnail isn't in R2.")
	case errors.As(err, &gerr):
		writeError(w, http.StatusBadGateway, "That thumbnail isn't kept offline yet, and R2 couldn't be reached: "+gerr.Message)
	default:
		slog.Error("offline thumbnail failed", "err", err)
		writeError(w, http.StatusInternalServerError, "could not keep the thumbnail offline")
	}
}

// warmOffline downloads the Square Thumbnails, Thumbnail Previews and Small
// versions of every
// photo in the Gallery and Photos in Flight that the offline copy doesn't
// have yet, so they show later without the internet. It reads the photos the
// way those pages do, so the read GitHub answers is the one they'll reuse.
// Anything that fails is logged and skipped; nothing here stops the pipeline.
func warmOffline(ctx context.Context, d routeDeps) {
	ctx, cancel := context.WithTimeout(ctx, warmTimeout)
	defer cancel()
	files, err := offlinePhotos(ctx, d)
	if err != nil {
		slog.Warn("offline copy: photos not read, so no thumbnails were downloaded", "err", err)
		return
	}
	images, err := findImages(ctx, d.store, d.findPhotos, files)
	if err != nil || !images.Checked {
		slog.Warn("offline copy: R2 not searched, so no thumbnails were downloaded", "err", err, "problem", images.Message)
		return
	}
	cfg, err := d.store.R2()
	if err != nil {
		slog.Warn("offline copy: settings not read", "err", err)
		return
	}
	urls := offlineThumbnailURLs(files, images)
	downloaded, failed := d.offline.Warm(ctx, cfg, urls)
	slog.Info("offline copy: thumbnails ready", "photos", len(files), "thumbnails", len(urls), "downloaded", downloaded, "failed", failed)
}

// offlinePhotos is every photo in the Gallery and in Photos in Flight, drafts
// and Undecided ones among them.
func offlinePhotos(ctx context.Context, d routeDeps) ([]github.InFlightFile, error) {
	cfg, err := d.store.GitHub()
	if err != nil {
		return nil, err
	}
	published, err := d.gh.Published(ctx, cfg)
	if err != nil {
		return nil, err
	}
	inFlight, err := d.gh.InFlight(ctx, cfg)
	if err != nil {
		return nil, err
	}
	files := make([]github.InFlightFile, 0, len(published.Files)+len(inFlight.Files))
	for _, f := range published.Files {
		files = append(files, f.InFlightFile)
	}
	return append(files, inFlight.Files...), nil
}

// offlineThumbnailURLs are the small images the pages preview files with.
func offlineThumbnailURLs(files []github.InFlightFile, images inFlightImages) []string {
	var urls []string
	for _, f := range files {
		urls = append(urls, offline.ThumbnailURLs(f.Data, images.ByPath[f.Path].URL)...)
	}
	return urls
}
