package github

import (
	"encoding/json"
	"errors"
	"net/http"
	"testing"
)

func TestSaveMetaGroup(t *testing.T) {
	f, c := newMainRepo(t, map[string]string{})
	values := []json.RawMessage{json.RawMessage("10"), json.RawMessage(" 11 "), json.RawMessage("10"), json.RawMessage("4.5")}
	got, err := c.SaveMetaGroup(t.Context(), placesGH, MetaGroup{ID: "wide-angle", Name: " Wide angle ", Field: "focalLength", Values: values})
	if err != nil {
		t.Fatalf("SaveMetaGroup() error = %v", err)
	}
	file := dataRoot + "/metainfo/wide-angle.json"
	want := "{\n  \"id\": \"wide-angle\",\n  \"name\": \"Wide angle\",\n  \"description\": \"\",\n  \"field\": \"focalLength\",\n  \"parent\": \"\",\n  \"values\": [\n    10,\n    11,\n    4.5\n  ]\n}\n"
	if staged(t, c, file) != want || !got.Changed || got.Before != nil {
		t.Errorf("SaveMetaGroup() = %+v, pending %q; want %q", got, staged(t, c, file), want)
	}
	if w := f.writes(); len(w) != 0 {
		t.Errorf("SaveMetaGroup() wrote to GitHub: %v", w)
	}
}

func TestSaveMetaGroupRefuses(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{
		dataRoot + "/metainfo/ef-s-10-18.json": `{"id":"ef-s-10-18","name":"EF-S 10-18mm","description":"","field":"lens","values":[]}`,
	})
	tests := []struct {
		name   string
		group  MetaGroup
		status int
	}{
		{"no name", MetaGroup{ID: "a", Field: "lens"}, http.StatusBadRequest},
		{"unknown field", MetaGroup{ID: "a", Name: "A", Field: "title"}, http.StatusBadRequest},
		{"bad ID", MetaGroup{ID: "A B", Name: "A", Field: "lens"}, http.StatusBadRequest},
		{"value not a string or number", MetaGroup{ID: "a", Name: "A", Field: "lens", Values: []json.RawMessage{json.RawMessage("[1]")}}, http.StatusBadRequest},
		{"name taken in the field", MetaGroup{ID: "other", Name: "ef-s 10-18MM", Field: "lens"}, http.StatusConflict},
		{"range on a lens group", MetaGroup{ID: "a", Name: "A", Field: "lens", Range: &MetaRange{Min: 1, Max: 2}}, http.StatusBadRequest},
		{"range backwards", MetaGroup{ID: "a", Name: "A", Field: "iso", Range: &MetaRange{Min: 800, Max: 100}}, http.StatusBadRequest},
		{"parent missing", MetaGroup{ID: "a", Name: "A", Field: "lens", Parent: "nope"}, http.StatusBadRequest},
		{"parent of another field", MetaGroup{ID: "a", Name: "A", Field: "camera", Parent: "ef-s-10-18"}, http.StatusBadRequest},
		{"parent is itself", MetaGroup{ID: "ef-s-10-18", Name: "EF-S 10-18mm", Field: "lens", Parent: "ef-s-10-18"}, http.StatusBadRequest},
	}
	for _, tt := range tests {
		_, err := c.SaveMetaGroup(t.Context(), placesGH, tt.group)
		var perr *PublishError
		if !errors.As(err, &perr) || perr.Status != tt.status {
			t.Errorf("%s: SaveMetaGroup() error = %v, want status %d", tt.name, err, tt.status)
		}
	}
	// The same name is fine for another field.
	if _, err := c.SaveMetaGroup(t.Context(), placesGH, MetaGroup{ID: "other", Name: "EF-S 10-18mm", Field: "camera"}); err != nil {
		t.Errorf("SaveMetaGroup(another field) error = %v", err)
	}
}

func TestDeleteMetaGroup(t *testing.T) {
	file := dataRoot + "/metainfo/wide.json"
	saved := `{"id":"wide","name":"Wide","description":"","field":"focalLength","values":[10]}`
	_, c := newMainRepo(t, map[string]string{file: saved})
	got, err := c.DeleteMetaGroup(t.Context(), placesGH, "wide")
	if err != nil || !got.Changed || string(got.Before) != saved {
		t.Fatalf("DeleteMetaGroup() = %+v, %v; want the group removed", got, err)
	}
	if f, ok := stagedContent(t, c, file); !ok || !f.Deleted {
		t.Errorf("pending %+v, want %s deleted", f, file)
	}
	_, err = c.DeleteMetaGroup(t.Context(), placesGH, "wide")
	var perr *PublishError
	if !errors.As(err, &perr) || perr.Status != http.StatusNotFound {
		t.Errorf("DeleteMetaGroup(again) error = %v, want not found", err)
	}
}

func TestSaveMetaGroupRangeAndParent(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{
		dataRoot + "/metainfo/canon.json": `{"id":"canon","name":"Canon","description":"","field":"lens","parent":"","values":[]}`,
	})
	_, err := c.SaveMetaGroup(t.Context(), placesGH, MetaGroup{ID: "fast", Name: "Fast", Field: "exposure", Range: &MetaRange{Min: 0.0005, Max: 0.004}})
	want := "{\n  \"id\": \"fast\",\n  \"name\": \"Fast\",\n  \"description\": \"\",\n  \"field\": \"exposure\",\n  \"parent\": \"\",\n  \"values\": [],\n  \"range\": {\n    \"min\": 0.0005,\n    \"max\": 0.004\n  }\n}\n"
	if got := staged(t, c, dataRoot+"/metainfo/fast.json"); err != nil || got != want {
		t.Errorf("SaveMetaGroup(range) error = %v, pending %q; want %q", err, got, want)
	}
	if _, err := c.SaveMetaGroup(t.Context(), placesGH, MetaGroup{ID: "kit", Name: "Kit", Field: "lens", Parent: "canon"}); err != nil {
		t.Fatalf("SaveMetaGroup(parent) error = %v", err)
	}
	// Canon can't go into Kit, which is in Canon.
	_, err = c.SaveMetaGroup(t.Context(), placesGH, MetaGroup{ID: "canon", Name: "Canon", Field: "lens", Parent: "kit"})
	var perr *PublishError
	if !errors.As(err, &perr) || perr.Status != http.StatusBadRequest {
		t.Errorf("SaveMetaGroup(loop) error = %v, want refused", err)
	}
	// Nor can Canon be removed while Kit is in it.
	if _, err := c.DeleteMetaGroup(t.Context(), placesGH, "canon"); !errors.As(err, &perr) || perr.Status != http.StatusConflict {
		t.Errorf("DeleteMetaGroup(parent) error = %v, want refused", err)
	}
}
