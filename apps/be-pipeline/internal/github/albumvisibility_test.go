package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"
)

func TestSetAlbumHidden(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.files["main:data/albums/korea.json"] = "{\n  \"id\": \"korea\",\n  \"name\": \"Korea\",\n  \"parent\": null\n}\n"

	got, err := c.SetAlbumHidden(t.Context(), organizeGH, "korea", true)
	if err != nil {
		t.Fatalf("SetAlbumHidden() error = %v", err)
	}
	if got.Files != 1 || !strings.Contains(string(got.Changes[0].After), `"hidden": true`) {
		t.Errorf("SetAlbumHidden() = %+v, want korea.json hidden", got)
	}
	organized, err := c.Organize(t.Context(), organizeGH)
	if err != nil {
		t.Fatal(err)
	}
	if !organized.Albums[0].Hidden {
		t.Errorf("Organize() album = %+v, want it hidden", organized.Albums[0])
	}

	again, err := c.SetAlbumHidden(t.Context(), organizeGH, "korea", true)
	if err != nil || again.Files != 0 {
		t.Errorf("SetAlbumHidden(hidden again) = %+v, %v; want nothing changed", again, err)
	}
	shown, err := c.SetAlbumHidden(t.Context(), organizeGH, "korea", false)
	if err != nil || shown.Files != 1 || !strings.Contains(string(shown.Changes[0].After), `"hidden": false`) {
		t.Errorf("SetAlbumHidden(false) = %+v, %v; want it shown", shown, err)
	}

	_, err = c.SetAlbumHidden(t.Context(), organizeGH, "peru", true)
	var perr *PublishError
	if !errors.As(err, &perr) || perr.Status != http.StatusNotFound {
		t.Errorf("SetAlbumHidden(peru) error = %v, want not found", err)
	}
	if w := f.writes(); len(w) != 0 {
		t.Errorf("SetAlbumHidden() wrote to GitHub: %v", w)
	}
}
