package github

import (
	"encoding/json"
	"slices"
	"strings"
	"testing"
)

func TestPickGenrePhotos(t *testing.T) {
	_, c := bulkTagRepo(t, map[string]string{
		"c.json": `{"genres":[]}`,
		"a.json": `{}`,
		"b.json": `{"genres":["street"]}`,
		"d.json": `{"genres":[],"tags":["temple"]}`,
		"f.json": `{"file":`,
	})
	got, err := c.PickGenrePhotos(t.Context(), baseURLSettings, nil, 0)
	if err != nil {
		t.Fatalf("PickGenrePhotos() error = %v", err)
	}
	var names []string
	for _, p := range got.Photos {
		names = append(names, p.Name)
	}
	// b has a genre and f can't be read; the rest go by file name.
	if want := []string{"a", "c", "d"}; !slices.Equal(names, want) {
		t.Errorf("picked %v, want %v", names, want)
	}
	if got.WithoutGenres != 3 || got.PhotoFiles != 5 {
		t.Errorf("PickGenrePhotos() = %+v, want 3 without genres of 5 photo files", got)
	}

	got, err = c.PickGenrePhotos(t.Context(), baseURLSettings, []string{photosDir + "a.json"}, 1)
	if err != nil || len(got.Photos) != 1 || got.Photos[0].Name != "c" {
		t.Errorf("PickGenrePhotos(skip a, count 1) = %+v, %v; want c", got.Photos, err)
	}

	all := []string{photosDir + "a.json", photosDir + "c.json", photosDir + "d.json"}
	if _, err := c.PickGenrePhotos(t.Context(), baseURLSettings, all, 0); err == nil || !strings.Contains(err.Error(), "no more photos") {
		t.Errorf("PickGenrePhotos(skip all) error = %v, want no more photos", err)
	}
}

const genreSuggestAnswer = "```json\n" + `{
  "photos": [
    {"photo": "a", "genres": ["Street", "Night", "temple"]},
    {"photo": "b", "genres": ["street", "night photography", "Night"]},
    {"photo": "zzz", "genres": ["Street"]}
  ],
  "newGenres": [
    {"genre": "Night", "description": "Photos taken after dark."}
  ]
}` + "\n```"

func TestPreviewGenreSuggestions(t *testing.T) {
	_, c := bulkTagRepo(t, map[string]string{
		"a.json": `{"genres":[]}`,
		"b.json": `{"genres":["street"]}`,
	})
	got, err := c.PreviewGenreSuggestions(t.Context(), baseURLSettings, []string{photosDir + "a.json", photosDir + "b.json"}, genreSuggestAnswer)
	if err != nil {
		t.Fatalf("PreviewGenreSuggestions() error = %v", err)
	}
	a, b := got.Photos[0], got.Photos[1]
	if !slices.Equal(a.Add, []string{"street", "night"}) || len(a.Skipped) != 1 || !strings.Contains(a.Skipped[0].Reason, "a tag has that name") {
		t.Errorf("a = %+v, want street and night, temple left out as a tag", a)
	}
	if !slices.Equal(b.Add, []string{"night-photography", "night"}) || !slices.Equal(b.Already, []string{"street"}) {
		t.Errorf("b = %+v, want night-photography and night added, street already there", b)
	}
	want := []GenreNew{
		{ID: "night", Name: "Night", Description: "Photos taken after dark."},
		{ID: "night-photography", Name: "night photography"},
	}
	if !slices.Equal(got.NewGenres, want) {
		t.Errorf("NewGenres = %+v, want %+v", got.NewGenres, want)
	}
	if !slices.Equal(got.Unknown, []string{"zzz"}) {
		t.Errorf("Unknown = %v, want zzz", got.Unknown)
	}
	if _, err := c.PreviewGenreSuggestions(t.Context(), baseURLSettings, []string{photosDir + "a.json"}, `{"photos": []}`); err == nil {
		t.Error("PreviewGenreSuggestions(no photos) error = nil")
	}
}

func TestApplyGenreSuggestions(t *testing.T) {
	f, c := bulkTagRepo(t, map[string]string{
		"a.json": "{\n  \"genres\": [\n    \"street\"\n  ]\n}\n",
		"b.json": "{\n  \"genres\": []\n}\n",
	})
	got, err := c.ApplyGenreSuggestions(t.Context(), baseURLSettings, GenreSuggestions{
		NewGenres: []NewGroup{{ID: "night", Name: "Night", Description: "Photos taken after dark."}},
		Photos: []GenrePhoto{
			{Path: photosDir + "a.json", Genres: []string{"night"}},
			{Path: photosDir + "b.json", Genres: []string{"street", "night"}},
		},
	})
	if err != nil {
		t.Fatalf("ApplyGenreSuggestions() error = %v", err)
	}
	if got.NewGenres != 1 || got.Photos != 2 || len(got.Changes) != 3 {
		t.Errorf("ApplyGenreSuggestions() = %+v, want 1 new genre and 2 photos", got)
	}
	if w := f.writes(); len(w) != 0 {
		t.Errorf("wrote to GitHub: %v", w)
	}
	night, _ := stagedContent(t, c, dataRoot+"/genres/night.json")
	var genre groupJSON
	if json.Unmarshal([]byte(night.Content), &genre) != nil || genre.Name != "Night" || genre.Parent != nil {
		t.Errorf("night.json = %s", night.Content)
	}
	a, _ := stagedContent(t, c, photosDir+"a.json")
	if !strings.Contains(a.Content, "\"street\",\n    \"night\"") {
		t.Errorf("a.json = %s, want night after street", a.Content)
	}

	for name, s := range map[string]GenreSuggestions{
		"no photos":   {},
		"not a genre": {Photos: []GenrePhoto{{Path: photosDir + "a.json", Genres: []string{"temple"}}}},
		"taken name":  {NewGenres: []NewGroup{{ID: "temple", Name: "Temple"}}, Photos: []GenrePhoto{{Path: photosDir + "a.json", Genres: []string{"temple"}}}},
	} {
		if _, err := c.ApplyGenreSuggestions(t.Context(), baseURLSettings, s); err == nil {
			t.Errorf("ApplyGenreSuggestions(%s) error = nil", name)
		}
	}
}
