package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"
)

func TestSetTagFavorites(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.files["main:data/tags/night.json"] = `{"id":"night","name":"night"}`
	f.files["main:data/tags/hanok.json"] = `{"id":"hanok","name":"hanok"}`

	got, err := c.SetTagFavorites(t.Context(), organizeGH, map[string]bool{"night": true, "hanok": false})
	if err != nil {
		t.Fatalf("SetTagFavorites() error = %v", err)
	}
	if got.Files != 1 || !strings.Contains(string(got.Changes[0].After), `"favorite": true`) {
		t.Errorf("SetTagFavorites() = %+v, want only night.json a favorite", got)
	}
	organized, err := c.Organize(t.Context(), organizeGH)
	if err != nil {
		t.Fatal(err)
	}
	for _, tag := range organized.Tags {
		if tag.Favorite != (tag.ID == "night") {
			t.Errorf("Organize() tag %s favorite = %v", tag.ID, tag.Favorite)
		}
	}

	again, err := c.SetTagFavorites(t.Context(), organizeGH, map[string]bool{"night": true})
	if err != nil || again.Files != 0 {
		t.Errorf("SetTagFavorites(again) = %+v, %v; want nothing changed", again, err)
	}
	unpinned, err := c.SetTagFavorites(t.Context(), organizeGH, map[string]bool{"night": false})
	if err != nil || unpinned.Files != 1 || !strings.Contains(string(unpinned.Changes[0].After), `"favorite": false`) {
		t.Errorf("SetTagFavorites(false) = %+v, %v; want night unpinned", unpinned, err)
	}

	_, err = c.SetTagFavorites(t.Context(), organizeGH, map[string]bool{"temple": true})
	var perr *PublishError
	if !errors.As(err, &perr) || perr.Status != http.StatusNotFound {
		t.Errorf("SetTagFavorites(temple) error = %v, want not found", err)
	}
	if w := f.writes(); len(w) != 0 {
		t.Errorf("SetTagFavorites() wrote to GitHub: %v", w)
	}
}
