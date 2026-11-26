package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"
)

func TestSavePhotoBookCameraNames(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{})
	book := PhotoBook{ID: "korea", Name: "Korea", CameraNames: []PhotoBookCameraName{
		{Camera: " Fujifilm X-T5 ", Name: " X-T5 "},
		{Camera: "Sony A7", Name: " "},
		{Camera: "Ricoh GR III", Name: "Ricoh GR III"},
	}}
	if _, err := c.SavePhotoBook(t.Context(), placesGH, book); err != nil {
		t.Fatalf("SavePhotoBook() error = %v", err)
	}
	saved := staged(t, c, dataRoot+"/photobooks/korea.json")
	// Both are trimmed, and ones that rename nothing are left out.
	if !strings.Contains(saved, `"camera": "Fujifilm X-T5"`) || !strings.Contains(saved, `"name": "X-T5"`) || strings.Contains(saved, "Sony") || strings.Contains(saved, "Ricoh") {
		t.Errorf("saved %s", saved)
	}
	twice := PhotoBook{ID: "korea", Name: "Korea", CameraNames: []PhotoBookCameraName{{Camera: "A", Name: "x"}, {Camera: "A", Name: "y"}}}
	long := PhotoBook{ID: "korea", Name: "Korea", CameraNames: []PhotoBookCameraName{{Camera: "A", Name: strings.Repeat("x", maxEntryTextLength+1)}}}
	for _, b := range []PhotoBook{twice, long} {
		_, err := c.SavePhotoBook(t.Context(), placesGH, b)
		var perr *PublishError
		if !errors.As(err, &perr) || perr.Status != http.StatusBadRequest {
			t.Errorf("SavePhotoBook(%v) error = %v, want 400", b.CameraNames, err)
		}
	}
}
