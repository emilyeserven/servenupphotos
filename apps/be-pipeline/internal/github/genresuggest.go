package github

import (
	"cmp"
	"context"
	"net/http"
	"slices"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// GenrePick is the photos that Genre Suggestions picked to suggest genres for
// together.
type GenrePick struct {
	// Branch and PullRequest are as in BaseURLPreview.
	Branch      string              `json:"branch"`
	PullRequest *BaseURLPullRequest `json:"pullRequest"`
	PhotoFiles  int                 `json:"photoFiles"`
	// WithoutGenres is how many photo files have no genres.
	WithoutGenres int `json:"withoutGenres"`
	// Matching is how many photo files the pick picks from: the ones without
	// genres, or with Reassign the ones with genres (in Genre, when it's set).
	Matching int `json:"matching"`
	// Photos are as Bulk Tagging picks them, with nothing in Related.
	Photos []BulkTagPhoto `json:"photos"`
}

// GenrePickOptions says which photos Genre Suggestions picks.
type GenrePickOptions struct {
	// Skip is the photos already shown, to leave out.
	Skip []string `json:"skip"`
	// Count is how many photos to pick, 1 to 50; 0 picks 50.
	Count int `json:"count"`
	// Reassign picks photos that already have genres, to suggest their
	// genres again, instead of photos without any.
	Reassign bool `json:"reassign"`
	// Genre, with Reassign, picks only photos in this genre or one of its
	// subgenres, by ID, such as "architecture"; empty for any genre.
	Genre string `json:"genre"`
}

// PickGenrePhotos picks up to o.Count photos without genres (1 to 50, 50
// when unset), or with o.Reassign photos that have genres (in o.Genre or its
// subgenres when it's set), in file name order as Bulk Tagging's Any pick
// takes them, from the photo files as the next Commit will have them, leaving
// out o.Skip's paths. It only reads.
func (c *Client) PickGenrePhotos(ctx context.Context, gh settings.GitHub, o GenrePickOptions) (GenrePick, error) {
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return GenrePick{}, perr
	}
	match, perr := genrePickMatch(scan.w.groups()[Genres.Folder], o)
	if perr != nil {
		return GenrePick{}, perr
	}
	pick := GenrePick{Branch: scan.branch, PhotoFiles: len(scan.files), Photos: []BulkTagPhoto{}}
	if scan.pr != nil {
		pick.PullRequest = &BaseURLPullRequest{Number: scan.pr.Number, URL: scan.pr.HTMLURL}
	}
	var photos []bulkPhoto
	for _, f := range scan.files {
		p := readBulkPhoto(f)
		if f.err != "" {
			continue
		}
		if len(p.genres) == 0 {
			pick.WithoutGenres++
		}
		if match(p.genres) {
			pick.Matching++
			photos = appendUnskipped(photos, p, o.Skip)
		}
	}
	if len(photos) == 0 {
		return GenrePick{}, publishErr(http.StatusNotFound, "There are no more photos %s to pick from. Start over to pick from every one again.", genrePickWhat(o))
	}
	pick.Photos = pickFirst(photos, genreCount(o.Count))
	return pick, nil
}

// genrePickMatch is whether a photo with genres is one o picks from: one
// without genres, or with o.Reassign one with genres, in o.Genre or under it
// when that's set. It fails when o.Genre isn't a genre.
func genrePickMatch(genres []Group, o GenrePickOptions) (func(have []string) bool, *PublishError) {
	if !o.Reassign {
		return func(have []string) bool { return len(have) == 0 }, nil
	}
	if o.Genre == "" {
		return func(have []string) bool { return len(have) > 0 }, nil
	}
	if _, ok := findGroup(genres, o.Genre); !ok {
		return nil, publishErr(http.StatusNotFound, "There's no genre with the ID %q. Refresh to see what there is.", o.Genre)
	}
	within := genreAndUnder(genres, o.Genre)
	return func(have []string) bool {
		return slices.ContainsFunc(have, func(id string) bool { return within[id] })
	}, nil
}

// genreAndUnder is the genre id and every genre under it, however deep.
func genreAndUnder(genres []Group, id string) map[string]bool {
	found := map[string]bool{id: true}
	for grew := true; grew; {
		grew = false
		for _, g := range genres {
			if !found[g.ID] && found[g.Parent] {
				found[g.ID], grew = true, true
			}
		}
	}
	return found
}

// genrePickWhat names the photos o picks from, as an error says it, such as
// "with genres".
func genrePickWhat(o GenrePickOptions) string {
	switch {
	case !o.Reassign:
		return "without genres"
	case o.Genre != "":
		return "in that genre"
	}
	return "with genres"
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
		// Parent is the broader genre a new subgenre goes under, by name.
		Parent string `json:"parent"`
	} `json:"newGenres"`
}

// GenreNew is a genre the answer names that isn't one yet.
type GenreNew struct {
	ID string `json:"id"`
	// Name is the name as the answer first writes it, such as "Night".
	Name string `json:"name"`
	// Description is the answer's description of it; empty when it gave none.
	Description string `json:"description"`
	// Parent is the ID of the genre the answer makes it a subgenre of, an
	// existing genre or another new one, or "" for a top-level genre or a
	// parent that isn't either.
	Parent string `json:"parent"`
}

// GenreSuggestionsPreview is what pasting the LLM's answer would do: the
// genres each photo gets and the new genres to make.
type GenreSuggestionsPreview struct {
	// Photos lists, for each picked photo, the genre IDs to add in Add.
	Photos    []BulkTagPhotoPlan `json:"photos"`
	NewGenres []GenreNew         `json:"newGenres"`
	// Unknown is the photos in the answer that aren't any photo file's, which
	// are skipped.
	Unknown []string `json:"unknown"`
	// Others is the photos in the answer that weren't picked, found among
	// every photo, which the review shows after the picked ones.
	Others []BulkTagPhoto `json:"others"`
}

// PreviewGenreSuggestions reads answer, the LLM's JSON for the photos at
// paths (as PickGenrePhotos picked them), and says which genres each would
// get, which are new and which can't be genres. With reassign, each photo's
// Add is every genre the answer gives it, the ones it has too, since they
// replace its genres; otherwise only the ones it doesn't have. It only reads.
func (c *Client) PreviewGenreSuggestions(ctx context.Context, gh settings.GitHub, paths []string, answer string, reassign bool) (GenreSuggestionsPreview, error) {
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
	pickedPhotos, perr := picked(scan, paths)
	if perr != nil {
		return GenreSuggestionsPreview{}, perr
	}
	photos, unknown := answeredPhotos(scan, pickedPhotos, parsed.names())
	groups := scan.w.groups()
	g := genrePlanner{n: newGroupNamer(Genres, groups, scan.w.entries(MetaInfo)), descriptions: genreDescriptions(parsed), reassign: reassign}
	preview := GenreSuggestionsPreview{Photos: []BulkTagPhotoPlan{}, NewGenres: []GenreNew{}, Unknown: unknown, Others: answeredExtra(photos, len(pickedPhotos))}
	for _, p := range photos {
		preview.Photos = append(preview.Photos, g.plan(p, parsed))
	}
	preview.NewGenres = append(preview.NewGenres, withParents(g.fresh, parsed, groups[Genres.Folder])...)
	return preview, nil
}

// withParents is fresh with each new genre's Parent set to the genre the
// answer puts it under, found by ID or name, ignoring case, among genres and
// the other new genres; left empty when it's neither, or the genre itself.
func withParents(fresh []GenreNew, answer genreAnswer, genres []Group) []GenreNew {
	known := map[string]string{}
	for _, g := range genres {
		known[strings.ToLower(g.ID)], known[strings.ToLower(g.Name)] = g.ID, g.ID
	}
	for _, n := range fresh {
		known[strings.ToLower(n.ID)], known[strings.ToLower(n.Name)] = n.ID, n.ID
	}
	parents := map[string]string{}
	for _, d := range answer.NewGenres {
		name := strings.ToLower(strings.TrimSpace(d.Parent))
		if id := tagID(cleanTagName(d.Genre)); id != "" && name != "" {
			parents[id] = cmp.Or(known[name], known[tagID(cleanTagName(d.Parent))])
		}
	}
	out := make([]GenreNew, 0, len(fresh))
	for _, n := range fresh {
		if parent := parents[n.ID]; parent != n.ID {
			n.Parent = parent
		}
		out = append(out, n)
	}
	return out
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

// names is the photo names the answer lists, as it wrote them.
func (a genreAnswer) names() []string {
	out := make([]string, 0, len(a.Photos))
	for _, p := range a.Photos {
		out = append(out, p.Photo)
	}
	return out
}

// genrePlanner sorts an answer's genres for each photo, keeping the new ones.
type genrePlanner struct {
	n            *groupNamer
	descriptions map[string]string
	fresh        []GenreNew
	// reassign lists every genre the answer gives a photo in its Add, since
	// they replace the photo's genres.
	reassign bool
}

// plan is the genres the answer gives p.
func (g *genrePlanner) plan(p bulkPhoto, answer genreAnswer) BulkTagPhotoPlan {
	var names []string
	for _, a := range answer.Photos {
		if sameName(a.Photo, p.name) {
			names = append(names, a.Genres...)
		}
	}
	have := p.genres
	if g.reassign {
		have = nil
	}
	return g.n.planNames(p, have, names, g.addNew)
}

// addNew lists id as a new genre, once, named as the answer first wrote it.
func (g *genrePlanner) addNew(id, name string) {
	if !slices.ContainsFunc(g.fresh, func(n GenreNew) bool { return n.ID == id }) {
		g.fresh = append(g.fresh, GenreNew{ID: id, Name: name, Description: g.descriptions[id]})
	}
}

// GenrePhoto is the genres to add to one photo file, by ID, or with
// Reassign its genres from now on.
type GenrePhoto struct {
	Path   string   `json:"path"`
	Genres []string `json:"genres"`
}

// GenreSuggestions is what Genre Suggestions saves, as the review left it:
// the new genres to make, each with its parent when it's a subgenre, and the
// genres to add to each photo.
type GenreSuggestions struct {
	NewGenres []NewGroup   `json:"newGenres"`
	Photos    []GenrePhoto `json:"photos"`
	// Reassign replaces each photo's genres with the ones listed, instead of
	// adding them.
	Reassign bool `json:"reassign"`
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
// photo (or with s.Reassign makes them its genres), all as one save in the
// pending changes. Nothing is saved when a genre can't be made, a photo can't
// be read, or a reassigned photo would be left without genres.
func (c *Client) ApplyGenreSuggestions(ctx context.Context, gh settings.GitHub, s GenreSuggestions) (GenreSuggestionsResult, error) {
	if len(s.Photos) == 0 || len(s.Photos) > maxBulkTagPhotos {
		return GenreSuggestionsResult{}, publishErr(http.StatusBadRequest, "Add genres to 1 to %d photos at a time.", maxBulkTagPhotos)
	}
	adds := make([]photoAdds, 0, len(s.Photos))
	for _, p := range s.Photos {
		if s.Reassign && len(p.Genres) == 0 {
			return GenreSuggestionsResult{}, publishErr(http.StatusBadRequest, "Give %s at least one genre, or leave it out.", p.Path)
		}
		adds = append(adds, photoAdds{path: p.Path, ids: p.Genres, replace: s.Reassign})
	}
	saved, err := c.saveGroupsOnPhotos(ctx, gh, Genres, s.NewGenres, adds)
	if err != nil {
		return GenreSuggestionsResult{}, err
	}
	return GenreSuggestionsResult{pendingSave: saved.pendingSave, NewGenres: saved.made, Photos: saved.photos}, nil
}
