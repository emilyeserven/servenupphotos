package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"
)

// bigPair is a layout from the Layouts tab: two portrait photos filling a
// row, the text on the left.
var bigPair = PhotoBookLayout{ID: "custom-1", Name: " Big pair ", Photos: 2, PhotoBookLayoutLook: PhotoBookLayoutLook{Arrange: "row", Shape: "fill", Ratio: &PhotoBookRatio{Width: 4, Height: 5}, Text: "left", Captions: "column", TextShare: 80, Align: "center", Gap: -1, Margin: 3}}

func TestSavePhotoBookLayouts(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{})
	own := bigPair
	own.LeftPages = "own"
	left := own.PhotoBookLayoutLook
	left.Text, left.TextShare = "right", 5
	own.Left = &left
	book := PhotoBook{ID: "korea", Name: "Korea", HiddenLayouts: []string{"full", "full"}, Layouts: []PhotoBookLayout{own}, Pages: []PhotoBookPage{
		{ID: "p1", Layout: "custom-1", Slots: []PhotoBookSlot{{Photo: "a.json"}}},
	}}
	if _, err := c.SavePhotoBook(t.Context(), placesGH, book); err != nil {
		t.Fatalf("SavePhotoBook() error = %v", err)
	}
	saved := staged(t, c, dataRoot+"/photobooks/korea.json")
	// The name is trimmed, the numbers kept in range, and the page gets the
	// layout's two places.
	for _, want := range []string{`"name": "Big pair"`, `"textShare": 60`, `"gap": 0`, `"margin": 3`, `"layout": "custom-1"`, `"leftPages": "own"`, `"textShare": 10`, `"hiddenLayouts": [
    "full"
  ]`} {
		if !strings.Contains(saved, want) {
			t.Errorf("saved %s, want %s in it", saved, want)
		}
	}
	if strings.Count(saved, `"ratio"`) != 0 || strings.Count(saved, `"arrange"`) != 2 {
		t.Errorf("saved %s, want no ratio on a layout whose photos fill their room", saved)
	}
	l := bigPair
	l.Shape, l.LeftPages, l.Left, l.AlignTo, l.Title = "ratio", "mirror", &left, "photo", "off"
	if _, err := c.SavePhotoBook(t.Context(), placesGH, PhotoBook{ID: "korea", Name: "Korea", NoTitles: true, Layouts: []PhotoBookLayout{l}}); err != nil {
		t.Errorf("SavePhotoBook() with a 4:5 ratio error = %v", err)
	}
	if titled := staged(t, c, dataRoot+"/photobooks/korea.json"); !strings.Contains(titled, `"title": "off"`) || !strings.Contains(titled, `"noTitles": true`) {
		t.Errorf("saved %s, want the layout's title off and the book's titles off", titled)
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
		{"bad align to", with(func(l *PhotoBookLayout) { l.AlignTo = "page" })},
		{"bad title place", with(func(l *PhotoBookLayout) { l.Title = "below" })},
		{"ratio without sides", with(func(l *PhotoBookLayout) { l.Shape, l.Ratio = "ratio", nil })},
		{"ratio of 0", with(func(l *PhotoBookLayout) { l.Shape, l.Ratio = "ratio", &PhotoBookRatio{Width: 0, Height: 5} })},
		{"bad left pages", with(func(l *PhotoBookLayout) { l.LeftPages = "flipped" })},
		{"own left pages without a look", with(func(l *PhotoBookLayout) { l.LeftPages = "own" })},
		{"hiding a custom layout", PhotoBook{ID: "korea", Name: "Korea", HiddenLayouts: []string{"custom-1"}}},
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

func TestSavePhotoBookLayoutPrintOffsets(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{})
	l := bigPair
	wide, none := 25.0, -2.0
	l.PrintOffsetLeft, l.PrintOffsetRight = &wide, &none
	if _, err := c.SavePhotoBook(t.Context(), placesGH, PhotoBook{ID: "korea", Name: "Korea", Layouts: []PhotoBookLayout{l}}); err != nil {
		t.Fatalf("SavePhotoBook() error = %v", err)
	}
	// The print offsets are kept from 0 to 20.
	saved := staged(t, c, dataRoot+"/photobooks/korea.json")
	for _, want := range []string{`"margin": 3`, `"printOffsetLeft": 20`, `"printOffsetRight": 0`} {
		if !strings.Contains(saved, want) {
			t.Errorf("saved %s, want %s in it", saved, want)
		}
	}
	if _, err := c.SavePhotoBook(t.Context(), placesGH, PhotoBook{ID: "korea", Name: "Korea", Layouts: []PhotoBookLayout{bigPair}}); err != nil {
		t.Fatalf("SavePhotoBook() error = %v", err)
	}
	// A layout without them saves none.
	if same := staged(t, c, dataRoot+"/photobooks/korea.json"); strings.Contains(same, "printOffset") {
		t.Errorf("saved %s, want no print offsets", same)
	}
}
