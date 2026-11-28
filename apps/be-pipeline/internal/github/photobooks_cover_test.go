package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"
)

func TestSavePhotoBookCover(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{})
	book := PhotoBook{ID: "korea", Name: "Korea",
		Cover: &PhotoBookCover{Title: " Serven\r\nUp\r\nPhotos ", Author: " Emily Serven ", Volume: "Vol. 3", Background: "#000000"},
		Blurb: &PhotoBookBlurb{PageWidth: 12.625, PageHeight: 10.875, CoverWidth: 26.681, CoverHeight: 11.625, Spine: 0.569, Bleed: 0.306},
	}
	if _, err := c.SavePhotoBook(t.Context(), placesGH, book); err != nil {
		t.Fatalf("SavePhotoBook() error = %v", err)
	}
	saved := staged(t, c, dataRoot+"/photobooks/korea.json")
	// The words are trimmed, a line break kept as one, and unset fields left out.
	for _, want := range []string{`"title": "Serven\nUp\nPhotos"`, `"author": "Emily Serven"`, `"coverWidth": 26.681`, `"bleed": 0.306`} {
		if !strings.Contains(saved, want) {
			t.Errorf("saved %s, want %s in it", saved, want)
		}
	}
	if strings.Contains(saved, `"spine": ""`) || strings.Contains(saved, `"color"`) {
		t.Errorf("saved %s, want unset cover fields left out", saved)
	}
	blurb := func(change func(*PhotoBookBlurb)) *PhotoBookBlurb {
		b := *book.Blurb
		change(&b)
		return &b
	}
	bad := []PhotoBook{
		{ID: "korea", Name: "Korea", Cover: &PhotoBookCover{Title: strings.Repeat("x", maxPhotoBookCoverTitle+1)}},
		{ID: "korea", Name: "Korea", Cover: &PhotoBookCover{Title: "x", Author: strings.Repeat("x", maxEntryTextLength+1)}},
		{ID: "korea", Name: "Korea", Cover: &PhotoBookCover{Title: "x", Color: "white"}},
		{ID: "korea", Name: "Korea", Blurb: blurb(func(b *PhotoBookBlurb) { b.PageWidth = 0 })},
		{ID: "korea", Name: "Korea", Blurb: blurb(func(b *PhotoBookBlurb) { b.Spine = 30 })},
		{ID: "korea", Name: "Korea", Blurb: blurb(func(b *PhotoBookBlurb) { b.Bleed = -1 })},
		{ID: "korea", Name: "Korea", Blurb: blurb(func(b *PhotoBookBlurb) { b.Bleed = 6 })},
	}
	for _, b := range bad {
		_, err := c.SavePhotoBook(t.Context(), placesGH, b)
		var perr *PublishError
		if !errors.As(err, &perr) || perr.Status != http.StatusBadRequest {
			t.Errorf("SavePhotoBook(%+v, %+v) error = %v, want 400", b.Cover, b.Blurb, err)
		}
	}
}
