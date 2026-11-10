package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"
)

func TestSaveNotStoredPost(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{})
	post := NotStoredPost{ID: "2026-11-10", Day: "ignored", Note: "  Story repost "}
	if _, err := c.SaveNotStoredPost(t.Context(), placesGH, post); err != nil {
		t.Fatalf("SaveNotStoredPost() error = %v", err)
	}
	saved := staged(t, c, dataRoot+"/notstored/2026-11-10.json")
	// The day comes from the ID, and the note is trimmed.
	if !strings.Contains(saved, `"day": "2026-11-10"`) || !strings.Contains(saved, `"note": "Story repost"`) {
		t.Errorf("saved %s", saved)
	}
	tests := []struct {
		name string
		post NotStoredPost
	}{
		{"not a day", NotStoredPost{ID: "story"}},
		{"no such day", NotStoredPost{ID: "2026-02-30"}},
		{"long note", NotStoredPost{ID: "2026-11-10", Note: strings.Repeat("a", maxEntryTextLength+1)}},
	}
	for _, tt := range tests {
		_, err := c.SaveNotStoredPost(t.Context(), placesGH, tt.post)
		var perr *PublishError
		if !errors.As(err, &perr) || perr.Status != http.StatusBadRequest {
			t.Errorf("%s: SaveNotStoredPost() error = %v, want 400", tt.name, err)
		}
	}
}

func TestDeleteNotStoredPost(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{
		dataRoot + "/notstored/2026-11-10.json": `{"id":"2026-11-10","day":"2026-11-10","note":""}`,
	})
	result, err := c.DeleteNotStoredPost(t.Context(), placesGH, "2026-11-10")
	if err != nil || !result.Changed {
		t.Fatalf("DeleteNotStoredPost() = %+v, %v", result, err)
	}
}
