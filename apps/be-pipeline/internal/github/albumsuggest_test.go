package github

import (
	"encoding/json"
	"slices"
	"strings"
	"testing"
)

// albumRepo starts a fake repo whose photo data pull request has photos, by
// file name, the albums Japan and Kyoto (inside Japan), the tag temple and the
// genre street.
func albumRepo(t *testing.T, photos map[string]string) (*fakeGitHub, *Client) {
	t.Helper()
	f, c := newFakeGitHub(t)
	files := map[string]string{
		photosDir + "ALLPHOTOS.json":     "[]\n",
		dataRoot + "/albums/japan.json":  `{"id":"japan","name":"Japan","description":"","parent":null}`,
		dataRoot + "/albums/kyoto.json":  `{"id":"kyoto","name":"Kyoto","description":"","parent":"japan"}`,
		dataRoot + "/tags/temple.json":   `{"id":"temple","name":"temple","description":""}`,
		dataRoot + "/genres/street.json": `{"id":"street","name":"Street","description":""}`,
	}
	for name, content := range photos {
		files[photosDir+name] = content
	}
	f.openPull(prBranch, files)
	return f, c
}

func TestPickAlbumPhotos(t *testing.T) {
	_, c := albumRepo(t, map[string]string{
		"a.json": `{"albums":[],"tags":["temple","lanterns"],"city":"Kyoto"}`,
		"b.json": `{"albums":["kyoto"],"tags":["temple"],"city":"Kyoto"}`,
		"c.json": `{"albums":[],"city":"Kyoto"}`,
		"d.json": `{"tags":["temple","lanterns"],"city":"Osaka"}`,
		"e.json": `{"albums":[],"city":"Paris"}`,
	})
	got, err := c.PickAlbumPhotos(t.Context(), baseURLSettings, nil, 0)
	if err != nil {
		t.Fatalf("PickAlbumPhotos() error = %v", err)
	}
	var names []string
	for _, p := range got.Photos {
		names = append(names, p.Name)
	}
	// b is in an album, so it's never picked. d shares two tags with a, which
	// counts more than c's city; e shares nothing.
	if want := []string{"a", "d", "c"}; !slices.Equal(names, want) {
		t.Errorf("picked %v, want %v", names, want)
	}
	if got.WithoutAlbum != 4 || got.PhotoFiles != 5 {
		t.Errorf("PickAlbumPhotos() = %+v, want 4 without an album of 5 photo files", got)
	}
	if r := got.Photos[1].Related; !slices.Equal(r, []string{"same tag: temple", "same tag: lanterns"}) {
		t.Errorf("d related = %v", r)
	}
}

const albumAnswerText = "```json\n" + `{
  "albums": [
    {"album": "Kyoto", "photos": ["a", "zzz"]},
    {"album": "Osaka at Night", "description": "Neon and food stalls", "parent": "Japan", "photos": ["b"]},
    {"album": "kyoto", "photos": ["b"]},
    {"album": "Street", "photos": ["a"]},
    {"album": "Nowhere", "parent": "Atlantis", "photos": []}
  ]
}` + "\n```"

func TestPreviewAlbumSuggestions(t *testing.T) {
	_, c := albumRepo(t, map[string]string{"a.json": `{"albums":[]}`, "b.json": `{"albums":[]}`})
	a, b := photosDir+"a.json", photosDir+"b.json"
	got, err := c.PreviewAlbumSuggestions(t.Context(), baseURLSettings, []string{a, b}, albumAnswerText)
	if err != nil {
		t.Fatalf("PreviewAlbumSuggestions() error = %v", err)
	}
	if len(got.Albums) != 4 {
		t.Fatalf("Albums = %+v, want kyoto (merged), osaka-at-night, Street and nowhere", got.Albums)
	}
	kyoto, osaka, street, nowhere := got.Albums[0], got.Albums[1], got.Albums[2], got.Albums[3]
	if kyoto.ID != "kyoto" || kyoto.New || !slices.Equal(kyoto.Photos, []string{a, b}) {
		t.Errorf("kyoto = %+v, want the existing album with a and b", kyoto)
	}
	if osaka.ID != "osaka-at-night" || !osaka.New || osaka.Name != "Osaka at Night" || osaka.Parent != "japan" || osaka.Description != "Neon and food stalls" {
		t.Errorf("osaka = %+v, want a new album inside japan", osaka)
	}
	if street.Reason == "" || !strings.Contains(street.Reason, "genre") {
		t.Errorf("street = %+v, want left out as a genre's name", street)
	}
	if nowhere.Parent != "" || !nowhere.New {
		t.Errorf("nowhere = %+v, want a new album with no parent", nowhere)
	}
	if !slices.Equal(got.Unknown, []string{"zzz"}) {
		t.Errorf("Unknown = %v, want zzz", got.Unknown)
	}

	for _, bad := range []string{"no json", `{"albums": []}`} {
		if _, err := c.PreviewAlbumSuggestions(t.Context(), baseURLSettings, []string{a}, bad); err == nil {
			t.Errorf("PreviewAlbumSuggestions(%q) error = nil", bad)
		}
	}
}

func TestApplyAlbumSuggestions(t *testing.T) {
	f, c := albumRepo(t, map[string]string{
		"a.json": "{\n  \"albums\": []\n}\n",
		"b.json": "{\n  \"albums\": []\n}\n",
	})
	got, err := c.ApplyAlbumSuggestions(t.Context(), baseURLSettings, AlbumSuggestions{
		NewAlbums: []NewGroup{{ID: "osaka-at-night", Name: "Osaka at Night", Description: "Neon", Parent: "japan"}},
		Photos: []AlbumSuggestionsPhoto{
			{Path: photosDir + "a.json", Albums: []string{"kyoto"}},
			{Path: photosDir + "b.json", Albums: []string{"osaka-at-night"}},
		},
	})
	if err != nil {
		t.Fatalf("ApplyAlbumSuggestions() error = %v", err)
	}
	if got.NewAlbums != 1 || got.Photos != 2 || len(got.Changes) != 3 {
		t.Errorf("ApplyAlbumSuggestions() = %+v, want 1 new album and 2 photos", got)
	}
	if w := f.writes(); len(w) != 0 {
		t.Errorf("wrote to GitHub: %v", w)
	}
	osaka, _ := stagedContent(t, c, dataRoot+"/albums/osaka-at-night.json")
	var album groupJSON
	if json.Unmarshal([]byte(osaka.Content), &album) != nil || album.Name != "Osaka at Night" || album.Parent == nil || *album.Parent != "japan" {
		t.Errorf("osaka-at-night.json = %s", osaka.Content)
	}
	b, _ := stagedContent(t, c, photosDir+"b.json")
	if !strings.Contains(b.Content, "\"osaka-at-night\"") {
		t.Errorf("b.json = %s, want it in osaka-at-night", b.Content)
	}
}

func TestApplyAlbumSuggestionsErrors(t *testing.T) {
	_, c := albumRepo(t, map[string]string{"a.json": `{"albums":["kyoto"]}`})
	a := photosDir + "a.json"
	tests := []struct {
		name string
		s    AlbumSuggestions
		want string
	}{
		{"no photos", AlbumSuggestions{}, "Put 1 to 50"},
		{"not an album", AlbumSuggestions{Photos: []AlbumSuggestionsPhoto{{Path: a, Albums: []string{"temple"}}}}, "isn't one of the albums"},
		{"taken name", AlbumSuggestions{NewAlbums: []NewGroup{{ID: "temple", Name: "Temple"}}, Photos: []AlbumSuggestionsPhoto{{Path: a, Albums: []string{"temple"}}}}, "already has the ID"},
		{"nothing new", AlbumSuggestions{Photos: []AlbumSuggestionsPhoto{{Path: a, Albums: []string{"kyoto"}}}}, "nothing to change"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := c.ApplyAlbumSuggestions(t.Context(), baseURLSettings, tt.s)
			if err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Errorf("ApplyAlbumSuggestions() error = %v, want %q", err, tt.want)
			}
		})
	}
	if n := pendingCount(t, c); n != 0 {
		t.Errorf("pending = %d files, want none after errors", n)
	}
}
