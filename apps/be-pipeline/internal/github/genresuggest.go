package github

import (
	"context"
	"net/http"
	"slices"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// GenrePick is the photos without genres that Genre Suggestions picked to
// suggest genres for together.
type GenrePick struct {
	// Branch and PullRequest are as in BaseURLPreview.
	Branch      string              `json:"branch"`
	PullRequest *BaseURLPullRequest `json:"pullRequest"`
	PhotoFiles  int                 `json:"photoFiles"`
	// WithoutGenres is how many photo files have no genres.
	WithoutGenres int `json:"withoutGenres"`
	// Photos are as Bulk Tagging picks them, with nothing in Related.
	Photos []BulkTagPhoto `json:"photos"`
}

// PickGenrePhotos picks up to count photos without genres (1 to 50, 50 when
// unset), in file name order as Bulk Tagging's Any pick takes them, from the
// photo files as the next Commit will have them, leaving out skip's paths. It
// only reads.
func (c *Client) PickGenrePhotos(ctx context.Context, gh settings.GitHub, skip []string, count int) (GenrePick, error) {
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return GenrePick{}, perr
	}
	pick := GenrePick{Branch: scan.branch, PhotoFiles: len(scan.files), Photos: []BulkTagPhoto{}}
	if scan.pr != nil {
		pick.PullRequest = &BaseURLPullRequest{Number: scan.pr.Number, URL: scan.pr.HTMLURL}
	}
	var photos []bulkPhoto
	for _, f := range scan.files {
		if p := readBulkPhoto(f); f.err == "" && len(p.genres) == 0 {
			pick.WithoutGenres++
			photos = appendUnskipped(photos, p, skip)
		}
	}
	if len(photos) == 0 {
		return GenrePick{}, publishErr(http.StatusNotFound, "There are no more photos without genres to pick from. Start over to pick from every one again.")
	}
	pick.Photos = pickFirst(photos, genreCount(count))
	return pick, nil
}

// appendUnskipped is photos with p added, unless its path is one of skip.
func appendUnskipped(photos []bulkPhoto, p bulkPhoto, skip []string) []bulkPhoto {
	if slices.Contains(skip, p.file.path) {
		return photos
	}
	return append(photos, p)
}

// genreCount is count kept between 1 and maxBulkTagPhotos, or
// maxBulkTagPhotos when it isn't set.
func genreCount(count int) int {
	if count <= 0 {
		return maxBulkTagPhotos
	}
	return min(count, maxBulkTagPhotos)
}

// genreAnswer is the JSON the Genre Suggestions prompt asks the LLM for.
type genreAnswer struct {
	Photos []struct {
		// Photo is the photo's name, as the prompt lists it.
		Photo  string   `json:"photo"`
		Genres []string `json:"genres"`
	} `json:"photos"`
	// NewGenres describes each genre the answer uses that isn't one yet.
	NewGenres []struct {
		Genre       string `json:"genre"`
		Description string `json:"description"`
	} `json:"newGenres"`
}

// GenreNew is a genre the answer names that isn't one yet.
type GenreNew struct {
	ID string `json:"id"`
	// Name is the name as the answer first writes it, such as "Night".
	Name string `json:"name"`
	// Description is the answer's description of it; empty when it gave none.
	Description string `json:"description"`
}

// GenreSuggestionsPreview is what pasting the LLM's answer would do: the
// genres each photo gets and the new genres to make.
type GenreSuggestionsPreview struct {
	// Photos lists, for each picked photo, the genre IDs to add in Add.
	Photos    []BulkTagPhotoPlan `json:"photos"`
	NewGenres []GenreNew         `json:"newGenres"`
	// Unknown is the photos in the answer that aren't any of the picked ones.
	Unknown []string `json:"unknown"`
}

// PreviewGenreSuggestions reads answer, the LLM's JSON for the photos at
// paths (as PickGenrePhotos picked them), and says which genres each would
// get, which are new and which can't be genres. It only reads.
func (c *Client) PreviewGenreSuggestions(ctx context.Context, gh settings.GitHub, paths []string, answer string) (GenreSuggestionsPreview, error) {
	var parsed genreAnswer
	if perr := parseLLMAnswer(answer, &parsed); perr != nil {
		return GenreSuggestionsPreview{}, perr
	}
	if len(parsed.Photos) == 0 {
		return GenreSuggestionsPreview{}, publishErr(http.StatusBadRequest, "The answer has no photos in it. Ask the LLM to answer with genres for each photo.")
	}
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return GenreSuggestionsPreview{}, perr
	}
	photos, perr := picked(scan, paths)
	if perr != nil {
		return GenreSuggestionsPreview{}, perr
	}
	g := genrePlanner{n: newGroupNamer(Genres, scan.w.groups(), scan.w.entries(MetaInfo)), descriptions: genreDescriptions(parsed)}
	preview := GenreSuggestionsPreview{Photos: []BulkTagPhotoPlan{}, NewGenres: []GenreNew{}, Unknown: []string{}}
	for _, p := range photos {
		preview.Photos = append(preview.Photos, g.plan(p, parsed))
	}
	preview.NewGenres = append(preview.NewGenres, g.fresh...)
	preview.Unknown = unknownPhotos(photos, parsed)
	return preview, nil
}

// genreDescriptions is the answer's descriptions of its new genres, by the ID
// each gets.
func genreDescriptions(answer genreAnswer) map[string]string {
	out := map[string]string{}
	for _, d := range answer.NewGenres {
		if id := tagID(cleanTagName(d.Genre)); id != "" {
			out[id] = strings.TrimSpace(d.Description)
		}
	}
	return out
}

// unknownPhotos is the names in answer that aren't any of photos.
func unknownPhotos(photos []bulkPhoto, answer genreAnswer) []string {
	out := []string{}
	for _, a := range answer.Photos {
		if !slices.ContainsFunc(photos, func(p bulkPhoto) bool { return p.name == strings.TrimSpace(a.Photo) }) {
			out = append(out, a.Photo)
		}
	}
	return out
}

// genrePlanner sorts an answer's genres for each photo, keeping the new ones.
type genrePlanner struct {
	n            *groupNamer
	descriptions map[string]string
	fresh        []GenreNew
}

// plan is the genres the answer gives p.
func (g *genrePlanner) plan(p bulkPhoto, answer genreAnswer) BulkTagPhotoPlan {
	var names []string
	for _, a := range answer.Photos {
		if strings.TrimSpace(a.Photo) == p.name {
			names = append(names, a.Genres...)
		}
	}
	return g.n.planNames(p, p.genres, names, g.addNew)
}

// addNew lists id as a new genre, once, named as the answer first wrote it.
func (g *genrePlanner) addNew(id, name string) {
	if !slices.ContainsFunc(g.fresh, func(n GenreNew) bool { return n.ID == id }) {
		g.fresh = append(g.fresh, GenreNew{ID: id, Name: name, Description: g.descriptions[id]})
	}
}

// GenrePhoto is the genres to add to one photo file, by ID.
type GenrePhoto struct {
	Path   string   `json:"path"`
	Genres []string `json:"genres"`
}

// GenreSuggestions is what Genre Suggestions saves, as the review left it:
// the new genres to make, and the genres to add to each photo.
type GenreSuggestions struct {
	NewGenres []NewGroup   `json:"newGenres"`
	Photos    []GenrePhoto `json:"photos"`
}

// GenreSuggestionsResult says where Genre Suggestions' changes were saved: in
// the pending changes, for the next Commit.
type GenreSuggestionsResult struct {
	pendingSave
	// NewGenres is how many genres were made.
	NewGenres int `json:"newGenres"`
	// Photos is how many photo files got genres; the others already had them.
	Photos int `json:"photos"`
}

// ApplyGenreSuggestions makes the new genres and adds the genres to each
// photo, all as one save in the pending changes. Nothing is saved when a
// genre can't be made or a photo can't be read.
func (c *Client) ApplyGenreSuggestions(ctx context.Context, gh settings.GitHub, s GenreSuggestions) (GenreSuggestionsResult, error) {
	if len(s.Photos) == 0 || len(s.Photos) > maxBulkTagPhotos {
		return GenreSuggestionsResult{}, publishErr(http.StatusBadRequest, "Add genres to 1 to %d photos at a time.", maxBulkTagPhotos)
	}
	adds := make([]photoAdds, 0, len(s.Photos))
	for _, p := range s.Photos {
		adds = append(adds, photoAdds{path: p.Path, ids: p.Genres})
	}
	saved, err := c.saveGroupsOnPhotos(ctx, gh, Genres, s.NewGenres, adds)
	if err != nil {
		return GenreSuggestionsResult{}, err
	}
	return GenreSuggestionsResult{pendingSave: saved.pendingSave, NewGenres: saved.made, Photos: saved.photos}, nil
}
