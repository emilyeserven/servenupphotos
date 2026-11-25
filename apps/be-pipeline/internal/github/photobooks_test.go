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
	book := PhotoBook{ID: "korea", Name: " Korea ", Album: " korea-2026 ", Pages: []PhotoBookPage{
		{ID: "p1", Name: " By place ", LinkNext: true, Tags: []string{" by place ", "", "by place", "draft"}, Layout: "full", Title: &title, Slots: []PhotoBookSlot{{Photo: "a.json"}, {Photo: "extra.json"}}},
		{ID: "p2", Layout: "verticals-left", Alternates: " alt-1 ", Hidden: true},
		{ID: "p3", Layout: "full", Hidden: true},
	}, Order: &[]string{"p2", "gone", "p2", "p1"}, Size: &PhotoBookSize{Width: 12.5, Height: 10.625, Unit: "in"}, Budget: &PhotoBookBudget{Target: 40, Max: 60}}
	if _, err := c.SavePhotoBook(t.Context(), placesGH, book); err != nil {
		t.Fatalf("SavePhotoBook() error = %v", err)
	}
	saved := staged(t, c, dataRoot+"/photobooks/korea.json")
	// The name, album and title are trimmed, the full page keeps one slot, and the
	// pair gets its two empty ones.
	for _, want := range []string{`"name": "Korea"`, `"album": "korea-2026"`, `"name": "By place"`, `"linkNext": true`, `"tags": [
        "by place",
        "draft"
      ]`, `"unit": "in"`, `"target": 40`, `"max": 60`, `"alternates": "alt-1",
      "hidden": true`, `"title": "Seoul"`, `"photo": "a.json"`, `"order": [
    "p2",
    "p1"
  ]`} {
		if !strings.Contains(saved, want) {
			t.Errorf("saved %s, want %s in it", saved, want)
		}
	}
	if strings.Count(saved, `"hidden"`) != 1 {
		t.Errorf("saved %s, want only the alternate hidden", saved)
	}
	if strings.Contains(saved, "extra.json") || strings.Count(saved, `"photo": ""`) != 3 {
		t.Errorf("saved %s, want one slot on the full page and two empty on the pair", saved)
	}
	tests := []struct {
		name string
		book PhotoBook
	}{
		{"bad id", PhotoBook{ID: "Korea!", Name: "Korea"}},
		{"no name", PhotoBook{ID: "korea"}},
		{"bad unit", PhotoBook{ID: "korea", Name: "Korea", Size: &PhotoBookSize{Width: 1, Height: 1, Unit: "ft"}}},
		{"no height", PhotoBook{ID: "korea", Name: "Korea", Size: &PhotoBookSize{Width: 1, Unit: "in"}}},
		{"target over max", PhotoBook{ID: "korea", Name: "Korea", Budget: &PhotoBookBudget{Target: 50, Max: 40}}},
		{"negative budget", PhotoBook{ID: "korea", Name: "Korea", Budget: &PhotoBookBudget{Max: -1}}},
		{"long album", PhotoBook{ID: "korea", Name: "Korea", Album: strings.Repeat("a", maxEntryTextLength+1)}},
		{"unknown layout", PhotoBook{ID: "korea", Name: "Korea", Pages: []PhotoBookPage{{ID: "p1", Layout: "triptych"}}}},
		{"page without id", PhotoBook{ID: "korea", Name: "Korea", Pages: []PhotoBookPage{{Layout: "full"}}}},
		{"too many tags", PhotoBook{ID: "korea", Name: "Korea", Pages: []PhotoBookPage{{ID: "p", Layout: "full", Tags: strings.Fields(strings.Repeat("t ", 0) + "a b c d e f g h i j k l m n o p q r s t u")}}}},
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
