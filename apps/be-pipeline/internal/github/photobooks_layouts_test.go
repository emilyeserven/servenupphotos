package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"
)

// bigPair is a layout from the Layouts tab: two portrait photos filling a
// row, the text on the left.
var bigPair = PhotoBookLayout{ID: "custom-1", Name: " Big pair ", Photos: 2, Arrange: "row", Shape: "fill", Text: "left", Captions: "column", TextShare: 80, Align: "center", Gap: -1, Margin: 3}

func TestSavePhotoBookLayouts(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{})
	book := PhotoBook{ID: "korea", Name: "Korea", Layouts: []PhotoBookLayout{bigPair}, Pages: []PhotoBookPage{
		{ID: "p1", Layout: "custom-1", Slots: []PhotoBookSlot{{Photo: "a.json"}}},
	}}
	if _, err := c.SavePhotoBook(t.Context(), placesGH, book); err != nil {
		t.Fatalf("SavePhotoBook() error = %v", err)
	}
	saved := staged(t, c, dataRoot+"/photobooks/korea.json")
	// The name is trimmed, the numbers kept in range, and the page gets the
	// layout's two places.
	for _, want := range []string{`"name": "Big pair"`, `"textShare": 60`, `"gap": 0`, `"margin": 3`, `"layout": "custom-1"`} {
		if !strings.Contains(saved, want) {
			t.Errorf("saved %s, want %s in it", saved, want)
		}
	}
	if strings.Count(saved, `"photo": `) != 2 {
		t.Errorf("saved %s, want the page to have two places", saved)
	}
	with := func(change func(*PhotoBookLayout)) PhotoBook {
		l := bigPair
		change(&l)
		return PhotoBook{ID: "korea", Name: "Korea", Layouts: []PhotoBookLayout{l}}
	}
	tests := []struct {
		name string
		book PhotoBook
	}{
		{"id without custom-", with(func(l *PhotoBookLayout) { l.ID = "full" })},
		{"no name", with(func(l *PhotoBookLayout) { l.Name = " " })},
		{"five photos", with(func(l *PhotoBookLayout) { l.Photos = 5 })},
		{"bad shape", with(func(l *PhotoBookLayout) { l.Shape = "round" })},
		{"bad text side", with(func(l *PhotoBookLayout) { l.Text = "middle" })},
		{"same layout id", PhotoBook{ID: "korea", Name: "Korea", Layouts: []PhotoBookLayout{bigPair, bigPair}}},
		{"page with a gone layout", PhotoBook{ID: "korea", Name: "Korea", Pages: []PhotoBookPage{{ID: "p1", Layout: "custom-1"}}}},
	}
	for _, tt := range tests {
		_, err := c.SavePhotoBook(t.Context(), placesGH, tt.book)
		var perr *PublishError
		if !errors.As(err, &perr) || perr.Status != http.StatusBadRequest {
			t.Errorf("%s: SavePhotoBook() error = %v, want 400", tt.name, err)
		}
	}
}
