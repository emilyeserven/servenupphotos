package github

import (
	"slices"
	"strings"
	"testing"
)

func TestValidNoBreak(t *testing.T) {
	got, perr := validNoBreak([]string{" San Francisco ", "", "San Francisco", "ISO"})
	if perr != nil || !slices.Equal(got, []string{"San Francisco", "ISO"}) {
		t.Errorf("validNoBreak() = %q, %v", got, perr)
	}
	if _, perr := validNoBreak([]string{strings.Repeat("a", maxEntryTextLength+1)}); perr == nil {
		t.Error("validNoBreak(long) = nil error, want one")
	}
	many := make([]string, maxCaptionNoBreak+1)
	for i := range many {
		many[i] = strings.Repeat("a", i+1)
	}
	if _, perr := validNoBreak(many); perr == nil {
		t.Error("validNoBreak(too many) = nil error, want one")
	}
}

func TestSaveCaptionTemplateKeepsNameOptions(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{})
	template := CaptionTemplate{ID: "book", Name: "Book", Template: "{city}, {state}", NoBreak: []string{" San Francisco "}, StateAbbreviations: true}
	if _, err := c.SaveCaptionTemplate(t.Context(), placesGH, template); err != nil {
		t.Fatalf("SaveCaptionTemplate() error = %v", err)
	}
	saved := staged(t, c, dataRoot+"/captions/book.json")
	if !strings.Contains(saved, `"San Francisco"`) || !strings.Contains(saved, `"stateAbbreviations": true`) {
		t.Errorf("saved %s", saved)
	}
}
