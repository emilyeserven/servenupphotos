package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"
)

// portrait is a self-portrait with both links and a size.
func portrait(image string) *BioPortrait {
	return &BioPortrait{Image: image, Small: image + "-small", Width: 1800, Height: 1200, Alt: " Me "}
}

func TestSaveBio(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{})
	bio := Bio{ID: "bio", Text: "# Hi\n\nI take photos.", Photos: []BioPhoto{
		{Portrait: portrait("https://cdn.example/bio/a.webp")},
		{Photo: " apps/portfolio/src/data/photos/A.json "},
	}}
	if _, err := c.SaveBio(t.Context(), placesGH, bio); err != nil {
		t.Fatalf("SaveBio() error = %v", err)
	}
	saved := staged(t, c, dataRoot+"/bio/bio.json")
	// The self-portrait stays first, its alt text and the photo's path are
	// trimmed, and the Markdown is kept as written.
	for _, want := range []string{`"text": "# Hi\n\nI take photos."`, `"alt": "Me"`, `"photo": "apps/portfolio/src/data/photos/A.json"`} {
		if !strings.Contains(saved, want) {
			t.Errorf("saved %s, want %s in it", saved, want)
		}
	}
	if strings.Index(saved, "a.webp") > strings.Index(saved, "A.json") {
		t.Errorf("saved %s, want the photos in the order given", saved)
	}
	tests := []struct {
		name string
		bio  Bio
	}{
		{"another id", Bio{ID: "about"}},
		{"too long", Bio{ID: "bio", Text: strings.Repeat("a", maxBioText+1)}},
		{"neither", Bio{ID: "bio", Photos: []BioPhoto{{}}}},
		{"both", Bio{ID: "bio", Photos: []BioPhoto{{Photo: "a.json", Portrait: portrait("https://cdn.example/a.webp")}}}},
		{"no links", Bio{ID: "bio", Photos: []BioPhoto{{Portrait: &BioPortrait{Width: 1, Height: 1}}}}},
		{"no size", Bio{ID: "bio", Photos: []BioPhoto{{Portrait: &BioPortrait{Image: "https://a", Small: "https://b"}}}}},
		{"twice", Bio{ID: "bio", Photos: []BioPhoto{{Photo: "a.json"}, {Photo: "a.json"}}}},
	}
	for _, tt := range tests {
		_, err := c.SaveBio(t.Context(), placesGH, tt.bio)
		var perr *PublishError
		if !errors.As(err, &perr) || perr.Status != http.StatusBadRequest {
			t.Errorf("%s: SaveBio() error = %v, want 400", tt.name, err)
		}
	}
}
