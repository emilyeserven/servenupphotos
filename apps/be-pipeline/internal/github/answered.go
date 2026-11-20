package github

import (
	"context"
	"path"
	"slices"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// answeredPhotos is photos, the picked ones, followed by every other readable
// photo file that names (the photos an LLM's answer lists) calls by its name,
// each once, so an answer written for another batch of photos still applies
// to the photos it names. unknown is the names that aren't any photo file's,
// each once, as the answer wrote them.
func answeredPhotos(scan baseURLScan, photos []bulkPhoto, names []string) (all []bulkPhoto, unknown []string) {
	all = slices.Clone(photos)
	unknown = []string{}
	for _, name := range names {
		if matchName(name) == "" || slices.ContainsFunc(all, func(p bulkPhoto) bool { return sameName(name, p.name) }) {
			continue
		}
		if p, ok := photoNamed(scan, name); ok {
			all = append(all, p)
		} else {
			unknown = appendMissing(unknown, []string{name})
		}
	}
	return all, unknown
}

// photoNamed is the readable photo file whose name, without ".json", is
// name, matched with matchName.
func photoNamed(scan baseURLScan, name string) (bulkPhoto, bool) {
	i := slices.IndexFunc(scan.files, func(f photoFile) bool {
		return f.err == "" && sameName(name, strings.TrimSuffix(path.Base(f.path), path.Ext(f.path)))
	})
	if i < 0 {
		return bulkPhoto{}, false
	}
	return readBulkPhoto(scan.files[i]), true
}

// answeredExtra is the photos of all after the first picked ones, as the
// review shows them: the ones an answer named that weren't picked.
func answeredExtra(all []bulkPhoto, picked int) []BulkTagPhoto {
	out := []BulkTagPhoto{}
	for _, p := range all[picked:] {
		out = append(out, bulkTagPhoto(p, nil))
	}
	return out
}

// PhotosByName is the photo files an LLM's answer names, found among every
// photo, and the names that aren't any photo's.
type PhotosByName struct {
	Photos []BulkTagPhoto `json:"photos"`
	// Unknown is the names that aren't any photo file's, as they were given.
	Unknown []string `json:"unknown"`
}

// FindPhotosByName looks up each of names, a photo file's name without
// ".json" as the prompts call photos by, among every photo file, so a page
// that reads an LLM's answer itself (Bulk Places) can apply it to photos it
// didn't pick. It only reads.
func (c *Client) FindPhotosByName(ctx context.Context, gh settings.GitHub, names []string) (PhotosByName, error) {
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return PhotosByName{}, perr
	}
	all, unknown := answeredPhotos(scan, nil, names)
	return PhotosByName{Photos: answeredExtra(all, 0), Unknown: unknown}, nil
}
