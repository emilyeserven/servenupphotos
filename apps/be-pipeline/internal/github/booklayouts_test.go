package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"
)

func TestSaveStandardLayouts(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{})
	l := bigPair
	l.Standard = "custom-9"
	file := StandardLayouts{ID: " standard ", Layouts: []PhotoBookLayout{l}, HiddenLayouts: []string{"full", "full", "pair-left"}}
	if _, err := c.SaveStandardLayouts(t.Context(), placesGH, file); err != nil {
		t.Fatalf("SaveStandardLayouts() error = %v", err)
	}
	saved := staged(t, c, dataRoot+"/booklayouts/standard.json")
	// The layout is checked as a book's is, a standard layout names no
	// other, and each hidden layout is kept once.
	for _, want := range []string{`"id": "standard"`, `"name": "Big pair"`, `"textShare": 60`, `"full",
    "pair-left"`} {
		if !strings.Contains(saved, want) {
			t.Errorf("saved %s, want %s in it", saved, want)
		}
	}
	if strings.Contains(saved, `"standard": `) {
		t.Errorf("saved %s, want no standard link on a standard layout", saved)
	}
}

func TestSaveStandardLayoutsRefuses(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{})
	bad := bigPair
	bad.ID = "full"
	tests := []struct {
		name string
		file StandardLayouts
	}{
		{"another ID", StandardLayouts{ID: "mine"}},
		{"a layout without custom-", StandardLayouts{ID: "standard", Layouts: []PhotoBookLayout{bad}}},
		{"hiding a layout that isn't built in", StandardLayouts{ID: "standard", HiddenLayouts: []string{"custom-1"}}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := c.SaveStandardLayouts(t.Context(), placesGH, tt.file)
			var perr *PublishError
			if !errors.As(err, &perr) || perr.Status != http.StatusBadRequest {
				t.Errorf("SaveStandardLayouts() error = %v, want a 400", err)
			}
		})
	}
}
