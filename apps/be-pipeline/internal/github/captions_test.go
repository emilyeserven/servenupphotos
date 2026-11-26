package github

import (
	"errors"
	"net/http"
	"slices"
	"strings"
	"testing"
)

func TestSaveCaptionTemplate(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{})
	template := CaptionTemplate{ID: "instagram", Name: " Instagram ", Platform: "instagram", Template: "{title}\n📷 {camera}\n\n", Places: []CaptionPlaceForm{{When: "2", Text: " {place1}, {place2} ", More: []string{" {place1Romanized} ", " "}}, {Has: []string{"city"}, Lacks: []string{"state"}, Text: " "}}, PlaceReplacements: []CaptionPlaceReplacement{{From: "United States of America", To: "USA"}, {From: " ", To: "x"}}}
	if _, err := c.SaveCaptionTemplate(t.Context(), placesGH, template); err != nil {
		t.Fatalf("SaveCaptionTemplate() error = %v", err)
	}
	saved := staged(t, c, dataRoot+"/captions/instagram.json")
	// The name is trimmed, the text loses its trailing blank lines, and the
	// place name forms are trimmed without the empty one.
	if !strings.Contains(saved, `"name": "Instagram"`) || !strings.Contains(saved, `"template": "{title}\n📷 {camera}"`) || !strings.Contains(saved, `"text": "{place1}, {place2}"`) || !strings.Contains(saved, `"{place1Romanized}"`) || strings.Count(saved, `"when"`) != 1 || !strings.Contains(saved, `"to": "USA"`) || strings.Count(saved, `"from"`) != 1 {
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
		{"too many form lines", CaptionTemplate{ID: "a", Name: "A", Template: "{title}", Places: []CaptionPlaceForm{{Text: "{city}", More: slices.Repeat([]string{"{city}"}, maxPlaceFormLines+1)}}}},
		{"bad condition field", CaptionTemplate{ID: "a", Name: "A", Template: "{title}", Places: []CaptionPlaceForm{{Has: []string{"city state"}, Text: "{city}"}}}},
		{"bad place count", CaptionTemplate{ID: "a", Name: "A", Template: "{title}", Places: []CaptionPlaceForm{{When: "4", Text: "{place1}"}}}},
		{"long place form", CaptionTemplate{ID: "a", Name: "A", Template: "{title}", Places: []CaptionPlaceForm{{When: "any", Text: strings.Repeat("a", maxEntryTextLength+1)}}}},
		{"long place exception", CaptionTemplate{ID: "a", Name: "A", Template: "{title}", PlaceReplacements: []CaptionPlaceReplacement{{From: "a", To: strings.Repeat("a", maxEntryTextLength+1)}}}},
		{"too many place forms", CaptionTemplate{ID: "a", Name: "A", Template: "{title}", Places: slices.Repeat([]CaptionPlaceForm{{When: "any", Text: "{city}"}}, maxCaptionPlaceForms+1)}},
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
