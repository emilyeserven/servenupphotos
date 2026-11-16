package github

import (
	"encoding/json"
	"errors"
	"net/http"
	"path"
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

// The bio file isn't its combined list: a second save knows the first, and
// Commit puts the bio in the combined list.
func TestSaveBioTwiceThenCommit(t *testing.T) {
	if strings.EqualFold(BioID+".json", BioKind.AllFile) {
		t.Fatalf("the bio file %s.json has its combined list's name, %s", BioID, BioKind.AllFile)
	}
	f, c := newFakeGitHub(t)
	f.openPull(prBranch, with(emptyLists, map[string]string{}))
	first := Bio{ID: "bio", Text: "Hi", Photos: []BioPhoto{{Photo: dataRoot + "/photos/a.json"}}}
	if _, err := c.SaveBio(t.Context(), pullGH, first); err != nil {
		t.Fatalf("SaveBio() error = %v", err)
	}
	second := first
	second.Photos = append(second.Photos, BioPhoto{Portrait: portrait("http://cdn.example/bio/me.webp")})
	got, err := c.SaveBio(t.Context(), pullGH, second)
	if err != nil {
		t.Fatalf("second SaveBio() error = %v", err)
	}
	if !strings.Contains(string(got.Before), "a.json") || strings.Contains(string(got.Before), "me.webp") {
		t.Errorf("second SaveBio() before = %s, want the first save", got.Before)
	}
	if _, err := c.CommitCombined(t.Context(), pullGH, nil); err != nil {
		t.Fatalf("CommitCombined() error = %v", err)
	}
	all, _ := f.file(prBranch, path.Join(dataRoot, BioKind.Folder, BioKind.AllFile))
	var bios []Bio
	if err := json.Unmarshal([]byte(all), &bios); err != nil || len(bios) != 1 || len(bios[0].Photos) != 2 {
		t.Errorf("%s = %s, want the bio with both photos", BioKind.AllFile, all)
	}
}
