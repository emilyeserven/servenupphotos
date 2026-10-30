package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"
)

func TestSetAlbumLayout(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.files["main:data/albums/korea.json"] = "{\n  \"id\": \"korea\",\n  \"name\": \"Korea\",\n  \"parent\": null\n}\n"

	layout := AlbumLayout{
		Covers: []int{12, 3},
		Layout: []AlbumRow{
			{TextAbove: "  ## Day one\n", Photos: []int{12, 3}},
			{Photos: []int{40}, TextBelow: "Last light."},
			{TextAbove: "The end."},
		},
	}
	got, err := c.SetAlbumLayout(t.Context(), organizeGH, "korea", layout)
	if err != nil {
		t.Fatalf("SetAlbumLayout() error = %v", err)
	}
	after := string(got.Changes[0].After)
	if got.Files != 1 || !strings.Contains(after, `"covers": [12,3]`) ||
		!strings.Contains(after, `{"textAbove":"## Day one","photos":[12,3],"textBelow":""}`) ||
		!strings.Contains(after, `{"textAbove":"The end.","photos":[],"textBelow":""}`) {
		t.Errorf("SetAlbumLayout() = %s, want korea.json given the covers and trimmed rows", after)
	}
	organized, err := c.Organize(t.Context(), organizeGH)
	if err != nil {
		t.Fatal(err)
	}
	if album := organized.Albums[0]; len(album.Layout) != 3 || album.Layout[1].TextBelow != "Last light." || len(album.Covers) != 2 {
		t.Errorf("Organize() album = %+v, want its covers and 3 rows", album)
	}

	again, err := c.SetAlbumLayout(t.Context(), organizeGH, "korea", layout)
	if err != nil || again.Files != 0 {
		t.Errorf("SetAlbumLayout(same) = %+v, %v; want nothing changed", again, err)
	}
	reset, err := c.SetAlbumLayout(t.Context(), organizeGH, "korea", AlbumLayout{})
	if err != nil || reset.Files != 1 || !strings.Contains(string(reset.Changes[0].After), `"layout": []`) {
		t.Errorf("SetAlbumLayout(none) = %+v, %v; want the layout emptied", reset, err)
	}
	if w := f.writes(); len(w) != 0 {
		t.Errorf("SetAlbumLayout() wrote to GitHub: %v", w)
	}
}

func TestSetAlbumLayoutRefuses(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.files["main:data/albums/korea.json"] = "{\n  \"id\": \"korea\",\n  \"name\": \"Korea\"\n}\n"

	bad := map[string]AlbumLayout{
		"six covers":      {Covers: []int{1, 2, 3, 4, 5, 6}},
		"cover twice":     {Covers: []int{1, 1}},
		"not an ID":       {Layout: []AlbumRow{{Photos: []int{0}}}},
		"photo twice":     {Layout: []AlbumRow{{Photos: []int{1}}, {Photos: []int{1}}}},
		"five in a row":   {Layout: []AlbumRow{{Photos: []int{1, 2, 3, 4, 5}}}},
		"empty row":       {Layout: []AlbumRow{{TextAbove: "  "}}},
		"too long a text": {Layout: []AlbumRow{{TextBelow: strings.Repeat("a", maxRowTextChars+1)}}},
	}
	for name, layout := range bad {
		if _, err := c.SetAlbumLayout(t.Context(), organizeGH, "korea", layout); err == nil {
			t.Errorf("SetAlbumLayout(%s) error = nil, want one", name)
		}
	}
	_, err := c.SetAlbumLayout(t.Context(), organizeGH, "peru", AlbumLayout{})
	var perr *PublishError
	if !errors.As(err, &perr) || perr.Status != http.StatusNotFound {
		t.Errorf("SetAlbumLayout(peru) error = %v, want not found", err)
	}
}
