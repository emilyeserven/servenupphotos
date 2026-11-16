package httpapi

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gen2brain/webp"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/offline"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// imageSizesTimeout bounds measuring one request's Small versions. Most are
// kept by the offline copy already; the rest are downloaded from R2 once.
const imageSizesTimeout = 5 * time.Minute

// maxImageSizeURLs is how many Small versions one request can measure:
// every photo in the portfolio, with room to grow.
const maxImageSizeURLs = 5000

// sizeReaders is how many Small versions are measured at once.
const sizeReaders = 8

// imageSize is a Small version's width and height in pixels.
type imageSize struct {
	Width  int `json:"width"`
	Height int `json:"height"`
}

// sizeCache keeps the size of Small versions by URL. A remade version gets
// a new URL mark, so a cached size never outlives its image.
type sizeCache = keyCache[imageSize]

// imageSizeFunc measures the Small version at a URL; readImageSize in
// production.
type imageSizeFunc func(ctx context.Context, cfg settings.R2, url string) (imageSize, error)

// imageSizesRequest is the body of POST /photos/bucket/sizes: the Small
// versions to measure.
type imageSizesRequest struct {
	URLs []string `json:"urls"`
}

// measuredImage is one Small version's size, or why it couldn't be read.
type measuredImage struct {
	URL string `json:"url"`
	// Width and Height are 0 when Error says why it couldn't be read.
	Width  int    `json:"width"`
	Height int    `json:"height"`
	Error  string `json:"error,omitempty"`
}

// imageSizesResponse is the answer of POST /photos/bucket/sizes, in the
// order the URLs were sent.
type imageSizesResponse struct {
	Images []measuredImage `json:"images"`
}

// handleImageSizes measures the Small versions in the body, reading each
// from the offline copy (downloading it from R2 first when it isn't kept
// yet), so the Quality Check page can find photos that aren't the house
// aspect ratios. Nothing is saved.
func handleImageSizes(loadR2 func() (settings.R2, error), read imageSizeFunc) http.HandlerFunc {
	cache := newKeyCache[imageSize]()
	return func(w http.ResponseWriter, r *http.Request) {
		var req imageSizesRequest
		if !decodeEntryUpTo(w, r, &req, "Small versions to measure", 4<<20) {
			return
		}
		if len(req.URLs) == 0 || len(req.URLs) > maxImageSizeURLs {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("Send 1 to %d Small versions to measure.", maxImageSizeURLs))
			return
		}
		cfg, err := loadR2()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), imageSizesTimeout)
		defer cancel()
		images := measureImages(ctx, cfg, req.URLs, read, cache)
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			writeError(w, http.StatusGatewayTimeout, "Measuring the Small versions took too long. Try again: the ones read so far are kept.")
			return
		}
		writeJSON(w, http.StatusOK, imageSizesResponse{Images: images})
	}
}

// measureImages measures urls, sizeReaders at a time, through cache.
func measureImages(ctx context.Context, cfg settings.R2, urls []string, read imageSizeFunc, cache *sizeCache) []measuredImage {
	images := make([]measuredImage, len(urls))
	limit := make(chan struct{}, sizeReaders)
	var wg sync.WaitGroup
	for i, url := range urls {
		images[i].URL = url
		wg.Go(func() {
			limit <- struct{}{}
			defer func() { <-limit }()
			size, ok := cache.get(url)
			if !ok {
				var err error
				if size, err = read(ctx, cfg, url); err != nil {
					slog.Warn("small version not measured", "url", url, "err", err)
					images[i].Error = "Its Small version couldn't be read."
					return
				}
				cache.put(url, size)
			}
			images[i].Width, images[i].Height = size.Width, size.Height
		})
	}
	wg.Wait()
	return images
}

// readImageSize measures a Small version kept by the offline copy through
// file, from its WEBP header alone.
func readImageSize(file smallFileFunc) imageSizeFunc {
	return func(ctx context.Context, cfg settings.R2, url string) (imageSize, error) {
		if _, ok := offline.ThumbnailKey(url); !ok {
			return imageSize{}, fmt.Errorf("not a Small version in R2: %q", url)
		}
		path, err := file(ctx, cfg, url)
		if err != nil {
			return imageSize{}, err
		}
		f, err := os.Open(path) //nolint:gosec // a file in the offline folder, named from a thumbnail key
		if err != nil {
			return imageSize{}, err
		}
		defer f.Close() //nolint:errcheck // read-only
		c, err := webp.DecodeConfig(f)
		if err != nil {
			return imageSize{}, err
		}
		return imageSize{Width: c.Width, Height: c.Height}, nil
	}
}
