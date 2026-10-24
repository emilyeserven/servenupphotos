package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"
)

func TestSetAlbumOrder(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.files["main:data/albums/korea.json"] = "{\n  \"id\": \"korea\",\n  \"name\": \"Korea\",\n  \"parent\": null\n}\n"
	f.files["main:data/albums/japan.json"] = "{\n  \"id\": \"japan\",\n  \"name\": \"Japan\",\n  \"parent\": null,\n  \"order\": 2\n}\n"
	f.files["main:data/albums/chile.json"] = "{\n  \"id\": \"chile\",\n  \"name\": \"Chile\",\n  \"parent\": null\n}\n"

	got, err := c.SetAlbumOrder(t.Context(), organizeGH, []string{"korea", "japan"})
	if err != nil {
		t.Fatalf("SetAlbumOrder() error = %v", err)
	}
	// Japan already had 2, so only Korea's file changes.
	if got.Files != 1 || !strings.Contains(string(got.Changes[0].After), `"order": 1`) {
		t.Errorf("SetAlbumOrder() = %+v, want korea.json given order 1", got)
	}
	organized, err := c.Organize(t.Context(), organizeGH)
	if err != nil {
		t.Fatal(err)
	}
	var ids []string
	for _, a := range organized.Albums {
		ids = append(ids, a.ID)
	}
	if strings.Join(ids, ",") != "korea,japan,chile" {
		t.Errorf("Albums = %v, want korea, japan, then chile without an order", ids)
	}

	for _, ids := range [][]string{{"korea", "korea"}, {"peru"}} {
		if _, err := c.SetAlbumOrder(t.Context(), organizeGH, ids); err == nil {
			t.Errorf("SetAlbumOrder(%v) error = nil, want one", ids)
		}
	}
	if w := f.writes(); len(w) != 0 {
		t.Errorf("SetAlbumOrder() wrote to GitHub: %v", w)
	}
}

func TestSetSpotlightAlbum(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.files["main:data/albums/korea.json"] = "{\n  \"id\": \"korea\",\n  \"name\": \"Korea\",\n  \"spotlightZones\": [\"homepage\"]\n}\n"
	f.files["main:data/albums/japan.json"] = "{\n  \"id\": \"japan\",\n  \"name\": \"Japan\"\n}\n"

	got, err := c.SetSpotlightAlbum(t.Context(), organizeGH, "homepage", "japan")
	if err != nil {
		t.Fatalf("SetSpotlightAlbum() error = %v", err)
	}
	after := map[string]string{}
	for _, ch := range got.Changes {
		after[ch.Path] = string(ch.After)
	}
	if got.Files != 2 || !strings.Contains(after["data/albums/japan.json"], `"spotlightZones": ["homepage"]`) ||
		!strings.Contains(after["data/albums/korea.json"], `"spotlightZones": []`) {
		t.Errorf("SetSpotlightAlbum() = %v, want homepage moved from korea to japan", after)
	}

	none, err := c.SetSpotlightAlbum(t.Context(), organizeGH, "homepage", "")
	if err != nil || none.Files != 1 {
		t.Errorf("SetSpotlightAlbum(no album) = %+v, %v; want japan.json taken out", none, err)
	}

	_, err = c.SetSpotlightAlbum(t.Context(), organizeGH, "homepage", "peru")
	var perr *PublishError
	if !errors.As(err, &perr) || perr.Status != http.StatusNotFound {
		t.Errorf("SetSpotlightAlbum(peru) error = %v, want not found", err)
	}
	if _, err := c.SetSpotlightAlbum(t.Context(), organizeGH, "Home Page", "japan"); err == nil {
		t.Error("SetSpotlightAlbum(bad spot) error = nil, want one")
	}
}
