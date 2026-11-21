package github

import (
	"slices"
	"strings"
	"testing"
)

// genreTreeRepo is bulkTagRepo's repository with Architecture, Temples under
// it, and Street as genres, and photos in it.
func genreTreeRepo(t *testing.T, photos map[string]string) *Client {
	t.Helper()
	f, c := newFakeGitHub(t)
	files := map[string]string{
		photosDir + "ALLPHOTOS.json":           "[]\n",
		dataRoot + "/genres/street.json":       `{"id":"street","name":"Street","description":""}`,
		dataRoot + "/genres/architecture.json": `{"id":"architecture","name":"Architecture","description":""}`,
		dataRoot + "/genres/temples.json":      `{"id":"temples","name":"Temples","description":"","parent":"architecture"}`,
	}
	for name, content := range photos {
		files[photosDir+name] = content
	}
	f.openPull(prBranch, files)
	return c
}

func TestPickGenrePhotosToReassign(t *testing.T) {
	c := genreTreeRepo(t, map[string]string{
		"a.json": `{"genres":["architecture"]}`,
		"b.json": `{"genres":["temples","street"]}`,
		"c.json": `{"genres":["street"]}`,
		"d.json": `{"genres":[]}`,
	})
	names := func(o GenrePickOptions) []string {
		got, err := c.PickGenrePhotos(t.Context(), baseURLSettings, o)
		if err != nil {
			t.Fatalf("PickGenrePhotos(%+v) error = %v", o, err)
		}
		var out []string
		for _, p := range got.Photos {
			out = append(out, p.Name)
		}
		return out
	}
	if got := names(GenrePickOptions{Reassign: true}); !slices.Equal(got, []string{"a", "b", "c"}) {
		t.Errorf("reassign any genre picked %v, want a, b and c", got)
	}
	// b is in Temples, under Architecture.
	if got := names(GenrePickOptions{Reassign: true, Genre: "architecture"}); !slices.Equal(got, []string{"a", "b"}) {
		t.Errorf("reassign architecture picked %v, want a and b", got)
	}
	if _, err := c.PickGenrePhotos(t.Context(), baseURLSettings, GenrePickOptions{Reassign: true, Genre: "macro"}); err == nil {
		t.Error("PickGenrePhotos(not a genre) error = nil, want one")
	}
}

func TestPreviewGenreReassignWithSubgenre(t *testing.T) {
	c := genreTreeRepo(t, map[string]string{
		"a.json": `{"genres":["architecture","street"]}`,
	})
	answer := `{
  "photos": [{"photo": "a", "genres": ["Traditional architecture", "Street"]}],
  "newGenres": [{"genre": "Traditional architecture", "parent": "Architecture", "description": "Old buildings."}]
}`
	got, err := c.PreviewGenreSuggestions(t.Context(), baseURLSettings, []string{photosDir + "a.json"}, answer, true)
	if err != nil {
		t.Fatalf("PreviewGenreSuggestions() error = %v", err)
	}
	// Reassigning lists street too, though the photo has it, since the list replaces its genres.
	if a := got.Photos[0]; !slices.Equal(a.Add, []string{"traditional-architecture", "street"}) {
		t.Errorf("a = %+v, want traditional-architecture and street", a)
	}
	want := []GenreNew{{ID: "traditional-architecture", Name: "Traditional architecture", Description: "Old buildings.", Parent: "architecture"}}
	if !slices.Equal(got.NewGenres, want) {
		t.Errorf("NewGenres = %+v, want %+v", got.NewGenres, want)
	}
}

func TestApplyGenreReassign(t *testing.T) {
	c := genreTreeRepo(t, map[string]string{
		"a.json": "{\n  \"genres\": [\n    \"architecture\",\n    \"street\"\n  ]\n}\n",
	})
	got, err := c.ApplyGenreSuggestions(t.Context(), baseURLSettings, GenreSuggestions{
		NewGenres: []NewGroup{{ID: "traditional-architecture", Name: "Traditional architecture", Parent: "architecture"}},
		Photos:    []GenrePhoto{{Path: photosDir + "a.json", Genres: []string{"traditional-architecture"}}},
		Reassign:  true,
	})
	if err != nil {
		t.Fatalf("ApplyGenreSuggestions() error = %v", err)
	}
	if got.NewGenres != 1 || got.Photos != 1 {
		t.Errorf("ApplyGenreSuggestions() = %+v, want 1 new genre and 1 photo", got)
	}
	a, _ := stagedContent(t, c, photosDir+"a.json")
	if !strings.Contains(a.Content, `"traditional-architecture"`) || strings.Contains(a.Content, "street") {
		t.Errorf("a.json = %s, want only traditional-architecture", a.Content)
	}
	genre, _ := stagedContent(t, c, dataRoot+"/genres/traditional-architecture.json")
	if !strings.Contains(genre.Content, `"parent": "architecture"`) {
		t.Errorf("traditional-architecture.json = %s, want it under architecture", genre.Content)
	}

	empty := GenreSuggestions{Photos: []GenrePhoto{{Path: photosDir + "a.json"}}, Reassign: true}
	if _, err := c.ApplyGenreSuggestions(t.Context(), baseURLSettings, empty); err == nil {
		t.Error("ApplyGenreSuggestions(reassign to no genres) error = nil, want one")
	}
}
