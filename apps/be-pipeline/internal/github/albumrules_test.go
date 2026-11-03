package github

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"
)

func TestSetAlbumRules(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.files["main:data/albums/night.json"] = "{\n  \"id\": \"night\",\n  \"name\": \"Night\",\n  \"parent\": null\n}\n"

	rules := map[string]json.RawMessage{
		"tag":         json.RawMessage(`"night"`),
		"orientation": json.RawMessage(`"vertical"`),
		"place":       json.RawMessage(`["seoul","busan"]`),
	}
	got, err := c.SetAlbumRules(t.Context(), organizeGH, "night", rules)
	if err != nil {
		t.Fatalf("SetAlbumRules() error = %v", err)
	}
	want := `"rules": {"orientation":"vertical","place":["seoul","busan"],"tag":"night"}`
	if got.Files != 1 || !strings.Contains(string(got.Changes[0].After), want) {
		t.Errorf("SetAlbumRules() = %s, want %s", got.Changes[0].After, want)
	}
	organized, err := c.Organize(t.Context(), organizeGH)
	if err != nil {
		t.Fatal(err)
	}
	if organized.Albums[0].Rules["tag"] != "night" {
		t.Errorf("Organize() album rules = %v, want the tag rule", organized.Albums[0].Rules)
	}

	cleared, err := c.SetAlbumRules(t.Context(), organizeGH, "night", nil)
	if err != nil || cleared.Files != 1 || !strings.Contains(string(cleared.Changes[0].After), `"rules": null`) {
		t.Errorf("SetAlbumRules(nil) = %+v, %v; want the rules cleared", cleared, err)
	}
	again, err := c.SetAlbumRules(t.Context(), organizeGH, "night", nil)
	if err != nil || again.Files != 0 {
		t.Errorf("SetAlbumRules(nil again) = %+v, %v; want nothing changed", again, err)
	}
	if w := f.writes(); len(w) != 0 {
		t.Errorf("SetAlbumRules() wrote to GitHub: %v", w)
	}
}

func TestSetAlbumRulesRefuses(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.files["main:data/albums/night.json"] = "{\n  \"id\": \"night\",\n  \"name\": \"Night\",\n  \"parent\": null\n}\n"
	tests := []struct {
		name   string
		rules  map[string]json.RawMessage
		id     string
		status int
	}{
		{"unknown filter", map[string]json.RawMessage{"sort": json.RawMessage(`"oldest"`)}, "night", http.StatusBadRequest},
		{"empty text", map[string]json.RawMessage{"tag": json.RawMessage(`""`)}, "night", http.StatusBadRequest},
		{"object", map[string]json.RawMessage{"tag": json.RawMessage(`{"a":1}`)}, "night", http.StatusBadRequest},
		{"empty list", map[string]json.RawMessage{"place": json.RawMessage(`[]`)}, "night", http.StatusBadRequest},
		{"no album", map[string]json.RawMessage{"tag": json.RawMessage(`"night"`)}, "peru", http.StatusNotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := c.SetAlbumRules(t.Context(), organizeGH, tt.id, tt.rules)
			var perr *PublishError
			if !errors.As(err, &perr) || perr.Status != tt.status {
				t.Errorf("SetAlbumRules() error = %v, want status %d", err, tt.status)
			}
		})
	}
}
