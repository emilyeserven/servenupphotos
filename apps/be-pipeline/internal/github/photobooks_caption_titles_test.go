package github

import (
	"strings"
	"testing"
)

// A book's Caption titles setting is kept on save, and left out when off.
func TestPhotoBookNoCaptionTitles(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{})
	if _, err := c.SavePhotoBook(t.Context(), placesGH, PhotoBook{ID: "korea", Name: "Korea", NoCaptionTitles: true}); err != nil {
		t.Fatal(err)
	}
	if saved := staged(t, c, dataRoot+"/photobooks/korea.json"); !strings.Contains(saved, `"noCaptionTitles": true`) {
		t.Fatalf("saved = %s", saved)
	}
	if _, err := c.SavePhotoBook(t.Context(), placesGH, PhotoBook{ID: "korea", Name: "Korea"}); err != nil {
		t.Fatal(err)
	}
	if saved := staged(t, c, dataRoot+"/photobooks/korea.json"); strings.Contains(saved, "noCaptionTitles") {
		t.Fatalf("saved = %s", saved)
	}
}
