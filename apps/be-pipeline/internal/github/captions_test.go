package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"
)

func TestSaveCaptionTemplate(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{})
	template := CaptionTemplate{ID: "instagram", Name: " Instagram ", Platform: "instagram", Template: "{title}\n📷 {camera}\n\n"}
	if _, err := c.SaveCaptionTemplate(t.Context(), placesGH, template); err != nil {
		t.Fatalf("SaveCaptionTemplate() error = %v", err)
	}
	saved := staged(t, c, dataRoot+"/captions/instagram.json")
	// The name is trimmed, and the text loses its trailing blank lines.
	if !strings.Contains(saved, `"name": "Instagram"`) || !strings.Contains(saved, `"template": "{title}\n📷 {camera}"`) {
		t.Errorf("saved %s", saved)
	}
	tests := []struct {
		name     string
		template CaptionTemplate
	}{
		{"no name", CaptionTemplate{ID: "a", Template: "{title}"}},
		{"no text", CaptionTemplate{ID: "a", Name: "A", Template: "  \n"}},
		{"too long", CaptionTemplate{ID: "a", Name: "A", Template: strings.Repeat("a", maxCaptionTemplateLength+1)}},
		{"bad ID", CaptionTemplate{ID: "A A", Name: "A", Template: "{title}"}},
	}
	for _, tt := range tests {
		_, err := c.SaveCaptionTemplate(t.Context(), placesGH, tt.template)
		var perr *PublishError
		if !errors.As(err, &perr) || perr.Status != http.StatusBadRequest {
			t.Errorf("%s: SaveCaptionTemplate() error = %v, want 400", tt.name, err)
		}
	}
	_, err := c.SaveCaptionTemplate(t.Context(), placesGH, CaptionTemplate{ID: "other", Name: "INSTAGRAM", Template: "{title}"})
	var perr *PublishError
	if !errors.As(err, &perr) || perr.Status != http.StatusConflict {
		t.Errorf("same name: SaveCaptionTemplate() error = %v, want 409", err)
	}
}

func TestDeleteCaptionTemplate(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{
		dataRoot + "/captions/instagram.json": `{"id":"instagram","name":"Instagram","platform":"","template":"{title}"}`,
	})
	result, err := c.DeleteCaptionTemplate(t.Context(), placesGH, "instagram")
	if err != nil || !result.Changed {
		t.Fatalf("DeleteCaptionTemplate() = %+v, %v", result, err)
	}
}
