package github

import (
	"context"
	"encoding/json"
	"sort"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// TagLibraryTag is one tag as the Tag library exports it.
type TagLibraryTag struct {
	Tag         string `json:"tag"`
	Description string `json:"description"`
	// Parent is the tag it's under, or "" at the top level.
	Parent string `json:"parent"`
	// Photos is how many photo files list it.
	Photos int `json:"photos"`
}

// TagLibraryPhotoInfo is one photo as the Tag library exports it: what's
// known of it that helps pick its tags.
type TagLibraryPhotoInfo struct {
	// Photo is its file name without .json.
	Photo string `json:"photo"`
	// Path is its file's path in the repository, which a save names it by.
	// The prompt leaves it out.
	Path string `json:"path"`
	// ID is its photo ID, or nil when it has none yet. The prompt leaves it
	// out.
	ID      *int     `json:"id"`
	Title   string   `json:"title"`
	City    string   `json:"city"`
	Country string   `json:"country"`
	Places  []string `json:"places"`
	Genres  []string `json:"genres"`
	Albums  []string `json:"albums"`
	Tags    []string `json:"tags"`
	// Notes is the photographer-only notes, "" when it has none.
	Notes string `json:"notes"`
}

// TagLibraryExport is every tag and every readable photo with its tags, as
// the next Commit will have them, for the Tag library prompt.
type TagLibraryExport struct {
	Tags   []TagLibraryTag       `json:"tags"`
	Photos []TagLibraryPhotoInfo `json:"photos"`
	// Unreadable is the photo files that couldn't be read, which the export
	// leaves out.
	Unreadable []string `json:"unreadable"`
	// MinPhotos is the fewest photos a tag should have.
	MinPhotos int `json:"minPhotos"`
}

// ExportTagLibrary reads every tag and photo file as the next Commit will
// have them, for the Tag library's prompt. It only reads.
func (c *Client) ExportTagLibrary(ctx context.Context, gh settings.GitHub) (TagLibraryExport, error) {
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return TagLibraryExport{}, perr
	}
	out := TagLibraryExport{Tags: []TagLibraryTag{}, Photos: []TagLibraryPhotoInfo{}, Unreadable: []string{}, MinPhotos: minTagPhotos}
	counts := tagCounts(scan)
	for _, g := range scan.w.groups()[Tags.Folder] {
		if g.Error == "" {
			out.Tags = append(out.Tags, TagLibraryTag{Tag: g.ID, Description: g.Description, Parent: g.Parent, Photos: counts[g.ID]})
		}
	}
	sort.Slice(out.Tags, func(i, j int) bool { return out.Tags[i].Tag < out.Tags[j].Tag })
	for _, f := range scan.files {
		if f.err != "" {
			out.Unreadable = append(out.Unreadable, f.path)
			continue
		}
		out.Photos = append(out.Photos, libraryPhotoInfo(f))
	}
	return out, nil
}

// libraryPhotoInfo is f, a readable photo file, as the export lists it.
func libraryPhotoInfo(f photoFile) TagLibraryPhotoInfo {
	p := readBulkPhoto(f)
	var data struct {
		ID                                              *int
		Title, CustomCity, City, CustomCountry, Country *string
	}
	_ = json.Unmarshal(f.content, &data)
	return TagLibraryPhotoInfo{
		Photo: p.name, Path: f.path, ID: data.ID, Title: firstText(data.Title),
		City: firstText(data.CustomCity, data.City), Country: firstText(data.CustomCountry, data.Country),
		Places: orEmpty(p.places), Genres: orEmpty(p.genres), Albums: orEmpty(p.albums), Tags: orEmpty(p.tags),
		Notes: photoNotes(f.content),
	}
}

// orEmpty is ids, or an empty list rather than null.
func orEmpty(ids []string) []string {
	if ids == nil {
		return []string{}
	}
	return ids
}
