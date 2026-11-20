package github

import (
	"slices"
	"testing"
)

func TestPreviewBulkTagsOutsideThePick(t *testing.T) {
	_, c := bulkTagRepo(t, map[string]string{
		"a.json": `{"tags":[]}`,
		"b.json": `{"tags":[]}`,
		"c.json": `{"tags":[]}`,
	})
	answer := `{"photos":[{"photo":"b","tags":["temple"]},{"photo":"zzz","tags":["temple"]},{"photo":"zzz","tags":["lanterns"]}]}`
	got, err := c.PreviewBulkTags(t.Context(), baseURLSettings, []string{photosDir + "a.json"}, answer)
	if err != nil {
		t.Fatalf("PreviewBulkTags() error = %v", err)
	}
	if len(got.Photos) != 2 || got.Photos[0].Name != "a" || got.Photos[1].Name != "b" {
		t.Fatalf("Photos = %+v, want the picked a, then b from the answer", got.Photos)
	}
	if len(got.Photos[0].Add) != 0 || !slices.Equal(got.Photos[1].Add, []string{"temple"}) {
		t.Errorf("Photos = %+v, want a unchanged and temple added to b", got.Photos)
	}
	if len(got.Others) != 1 || got.Others[0].Path != photosDir+"b.json" {
		t.Errorf("Others = %+v, want b", got.Others)
	}
	if !slices.Equal(got.Unknown, []string{"zzz"}) {
		t.Errorf("Unknown = %v, want zzz once", got.Unknown)
	}
}

func TestPreviewAltTextOutsideThePick(t *testing.T) {
	_, c := bulkTagRepo(t, map[string]string{"a.json": `{}`, "b.json": `{}`})
	got, err := c.PreviewAltText(t.Context(), baseURLSettings, []string{photosDir + "a.json"}, `{"photos":[{"photo":" b ","altText":"Two cats."}]}`)
	if err != nil {
		t.Fatalf("PreviewAltText() error = %v", err)
	}
	want := []AltTextSuggestion{{Path: photosDir + "a.json", Name: "a"}, {Path: photosDir + "b.json", Name: "b", AltText: "Two cats."}}
	if !slices.Equal(got.Photos, want) || len(got.Unknown) != 0 {
		t.Errorf("PreviewAltText() = %+v, want %+v and nothing unknown", got, want)
	}
}

func TestPreviewAlbumSuggestionsOutsideThePick(t *testing.T) {
	_, c := bulkTagRepo(t, map[string]string{"a.json": `{}`, "b.json": `{}`})
	answer := `{"albums":[{"album":"Kyoto Nights","photos":["a","b","zzz"]}]}`
	got, err := c.PreviewAlbumSuggestions(t.Context(), baseURLSettings, []string{photosDir + "a.json"}, answer)
	if err != nil {
		t.Fatalf("PreviewAlbumSuggestions() error = %v", err)
	}
	if len(got.Albums) != 1 || !slices.Equal(got.Albums[0].Photos, []string{photosDir + "a.json", photosDir + "b.json"}) {
		t.Errorf("Albums = %+v, want a and b in Kyoto Nights", got.Albums)
	}
	if !slices.Equal(got.Unknown, []string{"zzz"}) || len(got.Others) != 1 {
		t.Errorf("Unknown = %v, Others = %+v, want zzz unknown and b found", got.Unknown, got.Others)
	}
}

func TestFindPhotosByName(t *testing.T) {
	_, c := bulkTagRepo(t, map[string]string{"a.json": `{"city":"Kyoto"}`, "b.json": `{}`})
	got, err := c.FindPhotosByName(t.Context(), baseURLSettings, []string{"b", "a", "b", "", "zzz"})
	if err != nil {
		t.Fatalf("FindPhotosByName() error = %v", err)
	}
	if len(got.Photos) != 2 || got.Photos[0].Name != "b" || got.Photos[1].Name != "a" || string(got.Photos[1].Data) != `{"city":"Kyoto"}` {
		t.Errorf("Photos = %+v, want b then a, each once, with their data", got.Photos)
	}
	if !slices.Equal(got.Unknown, []string{"zzz"}) {
		t.Errorf("Unknown = %v, want zzz", got.Unknown)
	}
}

func TestPreviewBulkTagsMatchesNamesWithMatchName(t *testing.T) {
	_, c := bulkTagRepo(t, map[string]string{"a.json": `{"tags":[]}`, "b.json": `{"tags":[]}`})
	answer := `{"photos":[{"photo":"A.JSON","tags":["temple"]},{"photo":"“b”","tags":["lanterns"]}]}`
	got, err := c.PreviewBulkTags(t.Context(), baseURLSettings, []string{photosDir + "a.json"}, answer)
	if err != nil {
		t.Fatalf("PreviewBulkTags() error = %v", err)
	}
	if len(got.Photos) != 2 || !slices.Equal(got.Photos[0].Add, []string{"temple"}) || !slices.Equal(got.Photos[1].Add, []string{"lanterns"}) {
		t.Errorf("Photos = %+v, want temple on a and lanterns on b", got.Photos)
	}
	if len(got.Unknown) != 0 {
		t.Errorf("Unknown = %v, want none", got.Unknown)
	}
}
