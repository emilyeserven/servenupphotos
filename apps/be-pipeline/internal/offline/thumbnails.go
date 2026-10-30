// Package offline keeps what the pipeline needs to show the Gallery, the
// Undecided queue and drafts without the internet: each photo's Square
// Thumbnail and Thumbnail Preview on disk (and the X-Small versions the album
// layout preview has shown), and where each photo's image was
// found in R2 the last time R2 could be searched.
package offline

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"log/slog"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// GetFunc opens a Square Thumbnail in R2; storage.GetThumbnail in production.
type GetFunc func(ctx context.Context, cfg settings.R2, key string) (io.ReadCloser, error)

// ErrNotThumbnail is returned for a URL that isn't a Square Thumbnail's, a
// Thumbnail Preview's or an X-Small version's in the photos folder.
var ErrNotThumbnail = errors.New("only Square Thumbnails, Thumbnail Previews and X-Small versions are kept offline")

// errNoFolder is returned when the copy has no folder to keep files in.
var errNoFolder = errors.New("the offline copy has no folder")

// warmWorkers is how many thumbnails Warm downloads at once.
const warmWorkers = 4

// Copy is the offline copy, kept in one folder: thumbnails/ for the images and
// images.json for where each photo's image is in R2.
type Copy struct {
	dir string
	get GetFunc
	// mu guards images.json.
	mu sync.Mutex
}

// New returns the offline copy kept in dir, downloading thumbnails with get.
// With dir "" it keeps nothing.
func New(dir string, get GetFunc) *Copy {
	return &Copy{dir: dir, get: get}
}

// ThumbnailKey is the R2 key of the Square Thumbnail, Thumbnail Preview or X-Small version at
// raw, its public URL, whatever the host. ok is false for any other URL.
func ThumbnailKey(raw string) (key string, ok bool) {
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") {
		return "", false
	}
	_, key, found := strings.Cut(u.Path, "/photos/")
	key = "photos/" + key
	return key, found && storage.IsThumbnailKey(key)
}

// file is where the thumbnail at raw is kept on disk. The crop mark in its
// query is part of the name, since a remade Square Thumbnail keeps its key
// and only the mark tells it from the old one.
func (c *Copy) file(raw string) (string, error) {
	key, ok := ThumbnailKey(raw)
	if !ok {
		return "", ErrNotThumbnail
	}
	if c.dir == "" {
		return "", errNoFolder
	}
	u, _ := url.Parse(raw) // ThumbnailKey parsed it already
	sum := sha256.Sum256([]byte(key + "?" + u.RawQuery))
	name := strings.TrimSuffix(filepath.Base(key), ".webp") + "-" + hex.EncodeToString(sum[:6]) + ".webp"
	return filepath.Join(c.dir, "thumbnails", name), nil
}

// Has reports whether the thumbnail at raw is on disk already.
func (c *Copy) Has(raw string) bool {
	path, err := c.file(raw)
	if err != nil {
		return false
	}
	_, err = os.Stat(path)
	return err == nil
}

// Thumbnail is the path on disk of the thumbnail at raw, downloaded from R2
// first when it isn't there yet. Failures to download are *storage.GetError.
func (c *Copy) Thumbnail(ctx context.Context, cfg settings.R2, raw string) (string, error) {
	path, err := c.file(raw)
	if err != nil {
		return "", err
	}
	if _, err := os.Stat(path); err == nil {
		return path, nil
	}
	key, _ := ThumbnailKey(raw)
	return path, c.download(ctx, cfg, key, path)
}

// download saves the object at key to path, through a temporary file so a
// failed download never leaves half a thumbnail behind.
func (c *Copy) download(ctx context.Context, cfg settings.R2, key, path string) error {
	body, err := c.get(ctx, cfg, key)
	if err != nil {
		return err
	}
	defer body.Close() //nolint:errcheck // read-only body
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".download-*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name()) //nolint:errcheck // gone after the rename
	if _, err := io.Copy(tmp, body); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), path)
}

// Warm downloads each thumbnail in urls that isn't on disk yet, a few at a
// time, and says how many it downloaded and how many it couldn't.
func (c *Copy) Warm(ctx context.Context, cfg settings.R2, urls []string) (downloaded, failed int) {
	missing := make(chan string)
	var mu sync.Mutex
	var wg sync.WaitGroup
	for range warmWorkers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for raw := range missing {
				_, err := c.Thumbnail(ctx, cfg, raw)
				mu.Lock()
				if err != nil {
					failed++
					slog.Warn("offline copy: thumbnail not downloaded", "url", raw, "err", err)
				} else {
					downloaded++
				}
				mu.Unlock()
			}
		}()
	}
	for _, raw := range slices.Compact(slices.Sorted(slices.Values(urls))) {
		if !c.Has(raw) && ctx.Err() == nil {
			missing <- raw
		}
	}
	close(missing)
	wg.Wait()
	return downloaded, failed
}
