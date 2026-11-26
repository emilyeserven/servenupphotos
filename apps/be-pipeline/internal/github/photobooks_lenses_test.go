package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"
)

func TestSavePhotoBookLensPrefixes(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{})
	book := PhotoBook{ID: "korea", Name: "Korea", LensPrefixes: []PhotoBookLensPrefix{
		{Lens: " Fujinon XF35mmF2 ", Prefix: "Fujinon "},
		{Lens: "XF18mm", Prefix: " "},
	}}
	if _, err := c.SavePhotoBook(t.Context(), placesGH, book); err != nil {
		t.Fatalf("SavePhotoBook() error = %v", err)
	}
	saved := staged(t, c, dataRoot+"/photobooks/korea.json")
	// The lens is trimmed, the prefix kept as typed, and one that strips
	// nothing left out.
	if !strings.Contains(saved, `"lens": "Fujinon XF35mmF2"`) || !strings.Contains(saved, `"prefix": "Fujinon "`) || strings.Contains(saved, "XF18mm") {
		t.Errorf("saved %s", saved)
	}
	twice := PhotoBook{ID: "korea", Name: "Korea", LensPrefixes: []PhotoBookLensPrefix{{Lens: "A", Prefix: "x"}, {Lens: "A", Prefix: "y"}}}
	long := PhotoBook{ID: "korea", Name: "Korea", LensPrefixes: []PhotoBookLensPrefix{{Lens: "A", Prefix: strings.Repeat("x", maxEntryTextLength+1)}}}
	for _, b := range []PhotoBook{twice, long} {
		_, err := c.SavePhotoBook(t.Context(), placesGH, b)
		var perr *PublishError
		if !errors.As(err, &perr) || perr.Status != http.StatusBadRequest {
			t.Errorf("SavePhotoBook(%v) error = %v, want 400", b.LensPrefixes, err)
		}
	}
}
