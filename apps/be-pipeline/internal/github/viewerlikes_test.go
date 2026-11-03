package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestSaveViewerLikes(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{
		dataRoot + "/likes/jane.json": `{"id":"jane","name":"Jane","photos":[1,2],"importedAt":"2026-11-01T00:00:00Z"}`,
	})
	c.Now = func() time.Time { return time.Date(2026, 11, 3, 3, 32, 11, 0, time.UTC) }
	// Importing Jane's list again replaces it, sorted and each photo once.
	viewer := ViewerLikes{ID: "jane", Name: " Jane ", Photos: []int{40, 3, 12, 3}}
	got, err := c.SaveViewerLikes(t.Context(), placesGH, viewer)
	if err != nil {
		t.Fatalf("SaveViewerLikes() error = %v", err)
	}
	saved := staged(t, c, dataRoot+"/likes/jane.json")
	want := "{\n  \"id\": \"jane\",\n  \"name\": \"Jane\",\n  \"photos\": [\n    3,\n    12,\n    40\n  ],\n  \"importedAt\": \"2026-11-03T03:32:11Z\"\n}\n"
	if saved != want || !got.Changed {
		t.Errorf("saved %q, want %q", saved, want)
	}
	if _, err := c.SaveViewerLikes(t.Context(), placesGH, ViewerLikes{ID: "sam", Name: "Sam"}); err != nil {
		t.Errorf("empty list: SaveViewerLikes() error = %v", err)
	}
	if !strings.Contains(staged(t, c, dataRoot+"/likes/sam.json"), `"photos": []`) {
		t.Errorf("an empty list isn't saved as []")
	}
	tests := []struct {
		name   string
		viewer ViewerLikes
	}{
		{"no name", ViewerLikes{ID: "a", Photos: []int{1}}},
		{"bad ID", ViewerLikes{ID: "A A", Name: "A"}},
		{"zero", ViewerLikes{ID: "a", Name: "A", Photos: []int{0, 4}}},
		{"too many", ViewerLikes{ID: "a", Name: "A", Photos: manyPhotos(maxViewerLikes + 1)}},
	}
	for _, tt := range tests {
		_, err := c.SaveViewerLikes(t.Context(), placesGH, tt.viewer)
		var perr *PublishError
		if !errors.As(err, &perr) || perr.Status != http.StatusBadRequest {
			t.Errorf("%s: SaveViewerLikes() error = %v, want 400", tt.name, err)
		}
	}
}

// manyPhotos is the photo IDs 1 to n.
func manyPhotos(n int) []int {
	out := make([]int, n)
	for i := range out {
		out[i] = i + 1
	}
	return out
}
