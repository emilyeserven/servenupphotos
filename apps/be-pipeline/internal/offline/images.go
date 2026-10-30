package offline

import (
	"context"
	"encoding/json"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// FindFunc looks up uploaded photos in R2; storage.FindPhotos in production.
type FindFunc func(ctx context.Context, cfg settings.R2, refs []storage.PhotoRef) (map[storage.PhotoRef]storage.Uploaded, string)

// Note follows R2's problem when the images found the last time R2
// could be searched are shown instead.
const Note = "Showing the images found the last time R2 could be reached, with the thumbnails kept offline."

// savedImage is one photo's image as images.json keeps it.
type savedImage struct {
	Name  string           `json:"name"`
	URL   string           `json:"url,omitempty"`
	Key   string           `json:"key,omitempty"`
	Image storage.Uploaded `json:"image"`
}

// Find is find, keeping what it finds in images.json. When R2 can't be
// searched, it answers with the images found there last time for the refs it
// knows, and the problem followed by Note; with none known, just the
// problem.
func (c *Copy) Find(find FindFunc) FindFunc {
	return func(ctx context.Context, cfg settings.R2, refs []storage.PhotoRef) (map[storage.PhotoRef]storage.Uploaded, string) {
		found, problem := find(ctx, cfg, refs)
		if problem == "" {
			c.saveImages(found)
			return found, ""
		}
		saved := c.savedImages(refs)
		if len(saved) == 0 {
			return nil, problem
		}
		return saved, problem + " " + Note
	}
}

// savedImages is the images images.json has for refs.
func (c *Copy) savedImages(refs []storage.PhotoRef) map[storage.PhotoRef]storage.Uploaded {
	c.mu.Lock()
	all := c.loadImages()
	c.mu.Unlock()
	found := map[storage.PhotoRef]storage.Uploaded{}
	for _, ref := range refs {
		if image, ok := all[ref]; ok {
			found[ref] = image
		}
	}
	return found
}

// saveImages adds found to images.json, over what it had for the same refs.
func (c *Copy) saveImages(found map[storage.PhotoRef]storage.Uploaded) {
	if c.dir == "" || len(found) == 0 {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	all := c.loadImages()
	for ref, image := range found {
		all[ref] = image
	}
	list := make([]savedImage, 0, len(all))
	for ref, image := range all {
		list = append(list, savedImage{Name: ref.Name, URL: ref.URL, Key: ref.Key, Image: image})
	}
	if err := writeJSON(c.imagesFile(), list); err != nil {
		slog.Warn("offline copy: images not saved", "err", err)
	}
}

// loadImages reads images.json; a missing or broken file is an empty one.
func (c *Copy) loadImages() map[storage.PhotoRef]storage.Uploaded {
	all := map[storage.PhotoRef]storage.Uploaded{}
	if c.dir == "" {
		return all
	}
	raw, err := os.ReadFile(c.imagesFile())
	if err != nil {
		return all
	}
	var list []savedImage
	if err := json.Unmarshal(raw, &list); err != nil {
		slog.Warn("offline copy: images.json unreadable, starting over", "err", err)
		return all
	}
	for _, s := range list {
		all[storage.PhotoRef{Name: s.Name, URL: s.URL, Key: s.Key}] = s.Image
	}
	return all
}

func (c *Copy) imagesFile() string {
	return filepath.Join(c.dir, "images.json")
}

// writeJSON writes v to path through a temporary file, so a crash never
// leaves half a file.
func writeJSON(path string, v any) error {
	raw, err := json.Marshal(v)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
