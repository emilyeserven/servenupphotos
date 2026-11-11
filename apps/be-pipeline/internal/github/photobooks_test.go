package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"
)

func TestSavePhotoBook(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{})
	title := "  Seoul "
	book := PhotoBook{ID: "korea", Name: " Korea ", Pages: []PhotoBookPage{
		{ID: "p1", Layout: "full", Title: &title, Slots: []PhotoBookSlot{{Photo: "a.json"}, {Photo: "extra.json"}}},
		{ID: "p2", Layout: "pair-left"},
	}}
	if _, err := c.SavePhotoBook(t.Context(), placesGH, book); err != nil {
		t.Fatalf("SavePhotoBook() error = %v", err)
	}
	saved := staged(t, c, dataRoot+"/photobooks/korea.json")
	// The name and title are trimmed, the full page keeps one slot, and the
	// pair gets its two empty ones.
	for _, want := range []string{`"name": "Korea"`, `"title": "Seoul"`, `"photo": "a.json"`} {
		if !strings.Contains(saved, want) {
			t.Errorf("saved %s, want %s in it", saved, want)
		}
	}
	if strings.Contains(saved, "extra.json") || strings.Count(saved, `"photo": ""`) != 2 {
		t.Errorf("saved %s, want one slot on the full page and two empty on the pair", saved)
	}
	tests := []struct {
		name string
		book PhotoBook
	}{
		{"bad id", PhotoBook{ID: "Korea!", Name: "Korea"}},
		{"no name", PhotoBook{ID: "korea"}},
		{"unknown layout", PhotoBook{ID: "korea", Name: "Korea", Pages: []PhotoBookPage{{ID: "p1", Layout: "triptych"}}}},
		{"page without id", PhotoBook{ID: "korea", Name: "Korea", Pages: []PhotoBookPage{{Layout: "full"}}}},
		{"same page id", PhotoBook{ID: "korea", Name: "Korea", Pages: []PhotoBookPage{{ID: "p", Layout: "full"}, {ID: "p", Layout: "full"}}}},
	}
	for _, tt := range tests {
		_, err := c.SavePhotoBook(t.Context(), placesGH, tt.book)
		var perr *PublishError
		if !errors.As(err, &perr) || perr.Status != http.StatusBadRequest {
			t.Errorf("%s: SavePhotoBook() error = %v, want 400", tt.name, err)
		}
	}
}

func TestDeletePhotoBook(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{
		dataRoot + "/photobooks/korea.json": `{"id":"korea","name":"Korea","template":"","pages":[]}`,
	})
	result, err := c.DeletePhotoBook(t.Context(), placesGH, "korea")
	if err != nil || !result.Changed {
		t.Fatalf("DeletePhotoBook() = %+v, %v", result, err)
	}
}
