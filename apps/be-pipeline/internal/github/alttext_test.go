package github

import (
	"slices"
	"strings"
	"testing"
)

func TestPickAltTextPhotos(t *testing.T) {
	_, c := bulkTagRepo(t, map[string]string{
		"c.json": `{"altText":"  "}`,
		"a.json": `{}`,
		"b.json": `{"altText":"A red lantern over a dark alley."}`,
		"d.json": `{"altText":null}`,
		"f.json": `{"file":`,
	})
	got, err := c.PickAltTextPhotos(t.Context(), baseURLSettings, nil, 0)
	if err != nil {
		t.Fatalf("PickAltTextPhotos() error = %v", err)
	}
	var names []string
	for _, p := range got.Photos {
		names = append(names, p.Name)
	}
	// b has alt text and f can't be read; blank alt text counts as none.
	if want := []string{"a", "c", "d"}; !slices.Equal(names, want) {
		t.Errorf("picked %v, want %v", names, want)
	}
	if got.WithoutAltText != 3 || got.PhotoFiles != 5 || got.PullRequest == nil {
		t.Errorf("PickAltTextPhotos() = %+v, want 3 without alt text of 5 photo files", got)
	}

	got, err = c.PickAltTextPhotos(t.Context(), baseURLSettings, []string{photosDir + "a.json"}, 1)
	if err != nil || len(got.Photos) != 1 || got.Photos[0].Name != "c" {
		t.Errorf("PickAltTextPhotos(skip a, count 1) = %+v, %v; want c", got.Photos, err)
	}

	all := []string{photosDir + "a.json", photosDir + "c.json", photosDir + "d.json"}
	if _, err := c.PickAltTextPhotos(t.Context(), baseURLSettings, all, 0); err == nil || !strings.Contains(err.Error(), "no more photos") {
		t.Errorf("PickAltTextPhotos(skip all) error = %v, want no more photos", err)
	}
}

const altTextAnswerText = "Here you go:\n```json\n" + `{
  "photos": [
    {"photo": "a", "altText": "  A paper lantern glowing over a narrow alley at night.  "},
    {"photo": "b", "altText": ""},
    {"photo": "zzz", "altText": "Someone else's photo."}
  ]
}` + "\n```"

func TestPreviewAltText(t *testing.T) {
	_, c := bulkTagRepo(t, map[string]string{
		"a.json": `{}`,
		"b.json": `{"altText":"Old text."}`,
	})
	got, err := c.PreviewAltText(t.Context(), baseURLSettings, []string{photosDir + "a.json", photosDir + "b.json"}, altTextAnswerText)
	if err != nil {
		t.Fatalf("PreviewAltText() error = %v", err)
	}
	want := []AltTextSuggestion{
		{Path: photosDir + "a.json", Name: "a", AltText: "A paper lantern glowing over a narrow alley at night."},
		{Path: photosDir + "b.json", Name: "b", Current: "Old text."},
	}
	if !slices.Equal(got.Photos, want) {
		t.Errorf("Photos = %+v, want %+v", got.Photos, want)
	}
	if !slices.Equal(got.Unknown, []string{"zzz"}) {
		t.Errorf("Unknown = %v, want zzz", got.Unknown)
	}
	if _, err := c.PreviewAltText(t.Context(), baseURLSettings, []string{photosDir + "a.json"}, `{"photos": []}`); err == nil {
		t.Error("PreviewAltText(no photos) error = nil")
	}
}

func TestApplyAltText(t *testing.T) {
	f, c := bulkTagRepo(t, map[string]string{
		"a.json": "{\n  \"title\": null,\n  \"altText\": null,\n  \"tags\": []\n}\n",
		"b.json": "{\n  \"tags\": []\n}\n",
		"c.json": "{\n  \"altText\": \"Same.\"\n}\n",
	})
	got, err := c.ApplyAltText(t.Context(), baseURLSettings, AltTexts{Photos: []AltTextPhoto{
		{Path: photosDir + "a.json", AltText: " A \"quiet\" street <at> dawn. "},
		{Path: photosDir + "b.json", AltText: "Two cats on a wall."},
		{Path: photosDir + "c.json", AltText: "Same."},
	}})
	if err != nil {
		t.Fatalf("ApplyAltText() error = %v", err)
	}
	if got.Photos != 2 || len(got.Changes) != 2 {
		t.Errorf("ApplyAltText() = %+v, want 2 photos changed (c already has it)", got)
	}
	if w := f.writes(); len(w) != 0 {
		t.Errorf("wrote to GitHub: %v", w)
	}
	a, _ := stagedContent(t, c, photosDir+"a.json")
	if want := "{\n  \"title\": null,\n  \"altText\": \"A \\\"quiet\\\" street <at> dawn.\",\n  \"tags\": []\n}\n"; a.Content != want {
		t.Errorf("a.json = %q, want %q", a.Content, want)
	}
	b, _ := stagedContent(t, c, photosDir+"b.json")
	if !strings.Contains(b.Content, "\"altText\": \"Two cats on a wall.\"") {
		t.Errorf("b.json = %s, want the alt text added", b.Content)
	}

	for name, req := range map[string]AltTexts{
		"no photos":  {},
		"empty":      {Photos: []AltTextPhoto{{Path: photosDir + "a.json", AltText: "  "}}},
		"too long":   {Photos: []AltTextPhoto{{Path: photosDir + "a.json", AltText: strings.Repeat("a", maxAltTextLength+1)}}},
		"twice":      {Photos: []AltTextPhoto{{Path: photosDir + "b.json", AltText: "x"}, {Path: photosDir + "b.json", AltText: "y"}}},
		"not a file": {Photos: []AltTextPhoto{{Path: photosDir + "zzz.json", AltText: "x"}}},
		"no change":  {Photos: []AltTextPhoto{{Path: photosDir + "c.json", AltText: "Same."}}},
	} {
		if _, err := c.ApplyAltText(t.Context(), baseURLSettings, req); err == nil {
			t.Errorf("ApplyAltText(%s) error = nil", name)
		}
	}
}
