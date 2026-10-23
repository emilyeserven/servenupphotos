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
	want := "{\n  \"id\": \"wide-angle\",\n  \"name\": \"Wide angle\",\n  \"description\": \"\",\n  \"field\": \"focalLength\",\n  \"values\": [\n    10,\n    11,\n    4.5\n  ]\n}\n"
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
