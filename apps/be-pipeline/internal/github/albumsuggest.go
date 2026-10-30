package github

import (
	"context"
	"net/http"
	"slices"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// AlbumPick is the photos Album Suggestions picked to put in albums together.
type AlbumPick struct {
	// Branch and PullRequest are as in BaseURLPreview.
	Branch      string              `json:"branch"`
	PullRequest *BaseURLPullRequest `json:"pullRequest"`
	PhotoFiles  int                 `json:"photoFiles"`
	// WithoutAlbum is how many photo files aren't in an album.
	WithoutAlbum int            `json:"withoutAlbum"`
	Photos       []BulkTagPhoto `json:"photos"`
}

// PickAlbumPhotos picks up to count related photos (1 to 50, 5 when unset)
// to suggest albums for, from the photo files as the next Commit will have
// them, leaving out skip's paths.
// Only photos without albums are picked: the first by path, then the ones most
// like it, sharing its tags above all, then its places, city or country,
// genres and date. It only reads.
func (c *Client) PickAlbumPhotos(ctx context.Context, gh settings.GitHub, skip []string, count int) (AlbumPick, error) {
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return AlbumPick{}, perr
	}
	pick := AlbumPick{Branch: scan.branch, PhotoFiles: len(scan.files)}
	if scan.pr != nil {
		pick.PullRequest = &BaseURLPullRequest{Number: scan.pr.Number, URL: scan.pr.HTMLURL}
	}
	photos, without := photosWithout(scan, skip, func(p bulkPhoto) []string { return p.albums })
	pick.WithoutAlbum = without
	if len(photos) == 0 {
		return AlbumPick{}, publishErr(http.StatusNotFound, "There are no more photos without an album to pick from. Start over to pick from every one again.")
	}
	pick.Photos = pickRelated(photos, bulkTagCount(count), relateForAlbum)
	return pick, nil
}

// relateForAlbum is how alike other is to seed for an album: each shared tag
// counts most, then what relate counts.
func relateForAlbum(seed, other bulkPhoto) relation {
	var r relation
	for _, id := range shared(seed.tags, other.tags) {
		r.add(4, "same tag: "+id)
	}
	rest := relate(seed, other)
	r.score += rest.score
	r.reasons = append(r.reasons, rest.reasons...)
	return r
}

// albumAnswer is the JSON the Album Suggestions prompt asks the LLM for.
type albumAnswer struct {
	Albums []struct {
		// Album is an existing album's ID or name, or a new album's name.
		Album       string `json:"album"`
		Description string `json:"description"`
		// Parent is the existing album a new one goes inside, or "".
		Parent string `json:"parent"`
		// Photos are the photos' names, as the prompt lists them.
		Photos []string `json:"photos"`
	} `json:"albums"`
}

// AlbumSuggestion is one album the answer puts picked photos in.
type AlbumSuggestion struct {
	// ID is the album's ID, existing or new; "" when it can't be an album.
	ID   string `json:"id"`
	Name string `json:"name"`
	// Description is the answer's description of a new album.
	Description string `json:"description"`
	// Parent is the ID of the existing album a new one goes inside, or "".
	Parent string `json:"parent"`
	// New is true for an album that isn't one yet.
	New bool `json:"new"`
	// Photos are the paths of the picked photos to put in it, in the
	// answer's order.
	Photos []string `json:"photos"`
	// Reason says why it can't be an album; "" when it can.
	Reason string `json:"reason"`
}

// AlbumSuggestionsPreview is what pasting the LLM's answer would do: the
// albums, existing and new, and the picked photos each one gets.
type AlbumSuggestionsPreview struct {
	Albums []AlbumSuggestion `json:"albums"`
	// Unknown is the photos in the answer that aren't any of the picked ones.
	Unknown []string `json:"unknown"`
}

// PreviewAlbumSuggestions reads answer, the LLM's JSON for the photos at paths
// (as PickAlbumPhotos picked them), and says which album each would go in,
// which albums are new and which names can't be albums. It only reads.
func (c *Client) PreviewAlbumSuggestions(ctx context.Context, gh settings.GitHub, paths []string, answer string) (AlbumSuggestionsPreview, error) {
	var parsed albumAnswer
	if perr := readAnswerJSON(answer, &parsed); perr != nil {
		return AlbumSuggestionsPreview{}, perr
	}
	if len(parsed.Albums) == 0 {
		return AlbumSuggestionsPreview{}, publishErr(http.StatusBadRequest, "The answer has no albums in it. Ask the LLM to answer with albums for the photos.")
	}
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return AlbumSuggestionsPreview{}, perr
	}
	photos, perr := picked(scan, paths)
	if perr != nil {
		return AlbumSuggestionsPreview{}, perr
	}
	n := newGroupNamer(Albums, scan.w.groups(), scan.w.entries(MetaInfo))
	preview := AlbumSuggestionsPreview{Albums: []AlbumSuggestion{}, Unknown: []string{}}
	for _, a := range parsed.Albums {
		s := n.suggestion(a.Album, a.Description, a.Parent)
		for _, name := range a.Photos {
			s.Photos, preview.Unknown = addPicked(photos, strings.TrimSpace(name), s.Photos, preview.Unknown)
		}
		preview.Albums = mergeSuggestion(preview.Albums, s)
	}
	return preview, nil
}

// suggestion is the album the answer names: an existing one, a new one with
// its description and parent, or one that can't be an album, saying why.
func (n *tagNamer) suggestion(name, description, parent string) AlbumSuggestion {
	id, fresh, reason := n.sort(name)
	s := AlbumSuggestion{ID: id, Name: cleanTagName(name), New: fresh, Photos: []string{}, Reason: reason}
	if fresh {
		s.Description = strings.TrimSpace(description)
		s.Parent = n.existing(parent)
	}
	return s
}

// existing is the ID of the existing album named name, or "".
func (n *tagNamer) existing(name string) string {
	if id, fresh, reason := n.sort(name); !fresh && reason == "" {
		return id
	}
	return ""
}

// addPicked adds the path of the picked photo named name to paths, once, or
// name to unknown when it isn't one of photos.
func addPicked(photos []bulkPhoto, name string, paths, unknown []string) ([]string, []string) {
	i := slices.IndexFunc(photos, func(p bulkPhoto) bool { return p.name == name })
	if i < 0 {
		return paths, appendMissing(unknown, []string{name})
	}
	return appendMissing(paths, []string{photos[i].file.path}), unknown
}

// mergeSuggestion adds s to list, or its photos to the suggestion for the
// same album already in it.
func mergeSuggestion(list []AlbumSuggestion, s AlbumSuggestion) []AlbumSuggestion {
	i := slices.IndexFunc(list, func(o AlbumSuggestion) bool { return s.ID != "" && o.ID == s.ID })
	if i < 0 {
		return append(list, s)
	}
	list[i].Photos = appendMissing(list[i].Photos, s.Photos)
	return list
}

// AlbumSuggestionsPhoto is the albums to put one photo file in, by ID.
type AlbumSuggestionsPhoto struct {
	Path   string   `json:"path"`
	Albums []string `json:"albums"`
}

// AlbumSuggestions is what Album Suggestions saves, as the review left it: the
// new albums to make, and the albums to put each photo in.
type AlbumSuggestions struct {
	NewAlbums []NewGroup              `json:"newAlbums"`
	Photos    []AlbumSuggestionsPhoto `json:"photos"`
}

// AlbumSuggestionsResult says where Album Suggestions' changes were saved: in
// the pending changes, for the next Commit.
type AlbumSuggestionsResult struct {
	pendingSave
	// NewAlbums is how many albums were made.
	NewAlbums int `json:"newAlbums"`
	// Photos is how many photo files were put in albums.
	Photos int `json:"photos"`
}

// ApplyAlbumSuggestions makes the new albums and puts each photo in its
// albums, all as one save in the pending changes. Nothing is saved when an
// album can't be made or a photo can't be read.
func (c *Client) ApplyAlbumSuggestions(ctx context.Context, gh settings.GitHub, s AlbumSuggestions) (AlbumSuggestionsResult, error) {
	if len(s.Photos) == 0 || len(s.Photos) > maxBulkTagPhotos {
		return AlbumSuggestionsResult{}, publishErr(http.StatusBadRequest, "Put 1 to %d photos in albums at a time.", maxBulkTagPhotos)
	}
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return AlbumSuggestionsResult{}, perr
	}
	groups := scan.w.groups()
	albumChanges, perr := newGroupFiles(scan.w, groups, Albums, s.NewAlbums)
	if perr != nil {
		return AlbumSuggestionsResult{}, perr
	}
	adds := make([]photoAdd, 0, len(s.Photos))
	for _, p := range s.Photos {
		adds = append(adds, photoAdd{path: p.Path, ids: p.Albums})
	}
	photoChanges, perr := groupedPhotos(scan, Albums, groups[Albums.Folder], adds)
	if perr != nil {
		return AlbumSuggestionsResult{}, perr
	}
	if len(albumChanges)+len(photoChanges) == 0 {
		return AlbumSuggestionsResult{}, publishErr(http.StatusConflict, "Those photos are already in those albums, so there's nothing to change.")
	}
	saved, perr := c.saveFiles(scan.w, slices.Concat(albumChanges, photoChanges))
	if perr != nil {
		return AlbumSuggestionsResult{}, perr
	}
	return AlbumSuggestionsResult{pendingSave: saved, NewAlbums: len(albumChanges), Photos: len(photoChanges)}, nil
}
