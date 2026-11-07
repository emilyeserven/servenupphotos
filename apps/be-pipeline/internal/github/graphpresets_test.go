package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"
)

// dotGraph is a preset's graph: a dot for each aperture.
var dotGraph = &GraphSettings{Type: "dot", X: "aperture", Measure: "count", Sort: "group"}

func TestSaveGraphPreset(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{
		dataRoot + "/graphs/camera.json": `{"id":"camera","kind":"group","name":"Camera settings","order":1}`,
	})
	preset := GraphPreset{ID: "aperture", Kind: "preset", Name: " Aperture ", Order: 2, Group: "camera", Graph: dotGraph}
	if _, err := c.SaveGraphPreset(t.Context(), placesGH, preset); err != nil {
		t.Fatalf("SaveGraphPreset() error = %v", err)
	}
	saved := staged(t, c, dataRoot+"/graphs/aperture.json")
	if !strings.Contains(saved, `"name": "Aperture"`) || !strings.Contains(saved, `"group": "camera"`) || !strings.Contains(saved, `"x": "aperture"`) {
		t.Errorf("saved %s", saved)
	}
	thresholds := GraphPreset{ID: "wide", Kind: "preset", Name: "Wide", Graph: &GraphSettings{Type: "dot", X: "aperture", Measure: "count", Sort: "group", XMax: num(4), YMin: num(5)}}
	if _, err := c.SaveGraphPreset(t.Context(), placesGH, thresholds); err != nil {
		t.Fatalf("SaveGraphPreset(thresholds) error = %v", err)
	}
	if saved := staged(t, c, dataRoot+"/graphs/wide.json"); !strings.Contains(saved, `"xMax": 4`) || strings.Contains(saved, "xMin") {
		t.Errorf("thresholds saved as %s, want xMax and no xMin", saved)
	}
	group := GraphPreset{ID: "time", Kind: "group", Name: "Time", Group: "camera", Graph: dotGraph}
	if _, err := c.SaveGraphPreset(t.Context(), placesGH, group); err != nil {
		t.Fatalf("SaveGraphPreset(group) error = %v", err)
	}
	if saved := staged(t, c, dataRoot+"/graphs/time.json"); strings.Contains(saved, "graph") || strings.Contains(saved, "camera") {
		t.Errorf("a group keeps no graph or group: %s", saved)
	}
	tests := []struct {
		name   string
		preset GraphPreset
	}{
		{"no name", GraphPreset{ID: "a", Kind: "preset", Graph: dotGraph}},
		{"no graph", GraphPreset{ID: "a", Kind: "preset", Name: "A"}},
		{"odd kind", GraphPreset{ID: "a", Kind: "folder", Name: "A"}},
		{"odd type", GraphPreset{ID: "a", Kind: "preset", Name: "A", Graph: &GraphSettings{Type: "radar", X: "iso", Measure: "count", Sort: "group"}}},
		{"no such group", GraphPreset{ID: "a", Kind: "preset", Name: "A", Group: "lenses", Graph: dotGraph}},
		{"bad ID", GraphPreset{ID: "A A", Kind: "group", Name: "A"}},
		{"min above max", GraphPreset{ID: "a", Kind: "preset", Name: "A", Graph: &GraphSettings{Type: "dot", X: "iso", Measure: "count", Sort: "group", YMin: num(10), YMax: num(2)}}},
	}
	for _, tt := range tests {
		_, err := c.SaveGraphPreset(t.Context(), placesGH, tt.preset)
		var perr *PublishError
		if !errors.As(err, &perr) || perr.Status != http.StatusBadRequest {
			t.Errorf("%s: SaveGraphPreset() error = %v, want 400", tt.name, err)
		}
	}
}

func TestDeleteGraphPresetGroup(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{
		dataRoot + "/graphs/camera.json":   `{"id":"camera","kind":"group","name":"Camera settings","order":1}`,
		dataRoot + "/graphs/aperture.json": `{"id":"aperture","kind":"preset","name":"Aperture","order":1,"group":"camera","graph":{"type":"dot","x":"aperture","measure":"count","sort":"group"}}`,
	})
	_, err := c.DeleteGraphPreset(t.Context(), placesGH, "camera")
	var perr *PublishError
	if !errors.As(err, &perr) || perr.Status != http.StatusConflict {
		t.Fatalf("DeleteGraphPreset(group in use) error = %v, want 409", err)
	}
	if _, err := c.DeleteGraphPreset(t.Context(), placesGH, "aperture"); err != nil {
		t.Fatalf("DeleteGraphPreset(preset) error = %v", err)
	}
	if _, err := c.DeleteGraphPreset(t.Context(), placesGH, "camera"); err != nil {
		t.Errorf("DeleteGraphPreset(empty group) error = %v", err)
	}
}

// num is a threshold for a test preset.
func num(v float64) *float64 { return &v }
