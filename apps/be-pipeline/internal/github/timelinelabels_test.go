package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"
)

func TestSaveTimelineLabel(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{
		dataRoot + "/timeline/korea-2026-09-20.json": `{"id":"korea-2026-09-20","name":"Korea","start":"2026-09-20","end":"2026-09-21"}`,
	})
	label := TimelineLabel{ID: "japan-2026-09-22", Name: " Japan ", Start: "2026-09-22", End: "2026-10-02"}
	if _, err := c.SaveTimelineLabel(t.Context(), placesGH, label); err != nil {
		t.Fatalf("SaveTimelineLabel() error = %v", err)
	}
	saved := staged(t, c, dataRoot+"/timeline/japan-2026-09-22.json")
	if !strings.Contains(saved, `"name": "Japan"`) || !strings.Contains(saved, `"end": "2026-10-02"`) {
		t.Errorf("saved %s", saved)
	}
	tests := []struct {
		name  string
		label TimelineLabel
	}{
		{"no name", TimelineLabel{ID: "a", Start: "2026-01-01", End: "2026-01-02"}},
		{"not a date", TimelineLabel{ID: "a", Name: "A", Start: "Sept 1", End: "2026-01-02"}},
		{"ends first", TimelineLabel{ID: "a", Name: "A", Start: "2026-01-02", End: "2026-01-01"}},
		{"bad ID", TimelineLabel{ID: "A A", Name: "A", Start: "2026-01-01", End: "2026-01-01"}},
	}
	for _, tt := range tests {
		_, err := c.SaveTimelineLabel(t.Context(), placesGH, tt.label)
		var perr *PublishError
		if !errors.As(err, &perr) || perr.Status != http.StatusBadRequest {
			t.Errorf("%s: SaveTimelineLabel() error = %v, want 400", tt.name, err)
		}
	}
	overlap := TimelineLabel{ID: "seoul", Name: "Seoul", Start: "2026-09-21", End: "2026-09-21"}
	_, err := c.SaveTimelineLabel(t.Context(), placesGH, overlap)
	var perr *PublishError
	if !errors.As(err, &perr) || perr.Status != http.StatusConflict {
		t.Errorf("overlap: SaveTimelineLabel() error = %v, want 409", err)
	}
	// Saving a label again over its own days isn't an overlap.
	label.End = "2026-10-03"
	if _, err := c.SaveTimelineLabel(t.Context(), placesGH, label); err != nil {
		t.Errorf("resave: SaveTimelineLabel() error = %v", err)
	}
}
