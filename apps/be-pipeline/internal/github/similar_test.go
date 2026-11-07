package github

import (
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
	"testing"
)

const similarDir = "apps/portfolio/src/data/photos/"

// similarFile is a photo file with an image, these tags and this city, taken
// on day.
func similarFile(id int, tags, city, day string) string {
	return fmt.Sprintf(`{"id": %d, "file": "x.jpg", "width": 4, "height": 3, "images": {"small": "https://cdn/x.webp"}, `+
		`"tags": %s, "city": %q, "createDate": "%s 10:00:00"}`, id, tags, city, day)
}

func similarRepo() *baseURLRepo {
	return &baseURLRepo{pull: true, files: map[string]string{
		// A and B share two tags and a city; C shares one tag, and was taken
		// closer to B than to A; D shares nothing.
		"A.json": similarFile(1, `["canal", "boats"]`, "Amsterdam", "2016:12:16"),
		"B.json": similarFile(2, `["canal", "boats"]`, "Amsterdam", "2017:01:02"),
		"C.json": similarFile(3, `["canal"]`, "Utrecht", "2018:05:05"),
		"D.json": similarFile(4, `["forest"]`, "", "2019:07:07"),
	}}
}

// savedIDs is the IDs key holds in the staged file at name.
func savedIDs(t *testing.T, staged map[string]string, name, key string) []int {
	t.Helper()
	var fields map[string][]int
	_ = json.Unmarshal([]byte(staged[similarDir+name]), &fields)
	return fields[key]
}

func TestFindSimilarPhotos(t *testing.T) {
	repo := similarRepo()
	got, err := repo.start(t).FindSimilarPhotos(t.Context(), baseURLSettings)
	if err != nil {
		t.Fatalf("FindSimilarPhotos() error = %v", err)
	}
	if got.PhotoFiles != 4 || got.Photos != 4 {
		t.Errorf("FindSimilarPhotos() = %d of %d files, want 4 of 4", got.Photos, got.PhotoFiles)
	}
	staged := repo.staged(t)
	for name, want := range map[string][]int{"A.json": {2, 3}, "B.json": {1, 3}, "C.json": {2, 1}, "D.json": {}} {
		if ids := savedIDs(t, staged, name, similarKey); !slices.Equal(ids, want) {
			t.Errorf("%s similarPhotos = %v, want %v", name, ids, want)
		}
	}
	if a := staged[similarDir+"A.json"]; !strings.HasSuffix(a, ",\n  \"similarPhotos\": [2,3]}") {
		t.Errorf("A.json = %s, want the list added at the end", a)
	}
}

func TestFindSimilarPhotosAgainChangesNothing(t *testing.T) {
	repo := similarRepo()
	client := repo.start(t)
	if _, err := client.FindSimilarPhotos(t.Context(), baseURLSettings); err != nil {
		t.Fatalf("FindSimilarPhotos() error = %v", err)
	}
	_, err := client.FindSimilarPhotos(t.Context(), baseURLSettings)
	var perr *PublishError
	if !errors.As(err, &perr) || !strings.Contains(perr.Message, "already up to date") {
		t.Errorf("second FindSimilarPhotos() error = %v, want already up to date", err)
	}
}

func TestSetPickedSimilar(t *testing.T) {
	repo := similarRepo()
	got, err := repo.start(t).SetPickedSimilar(t.Context(), baseURLSettings, PickedSimilar{
		Path:  similarDir + "A.json",
		IDs:   []int{4, 3},
		Notes: map[string]string{"4": "  Same canal at night ", "3": " ", "2": "Not picked"},
	})
	if err != nil {
		t.Fatalf("SetPickedSimilar() error = %v", err)
	}
	if len(got.Changes) != 1 {
		t.Errorf("changes = %d, want 1", len(got.Changes))
	}
	staged := repo.staged(t)
	if ids := savedIDs(t, staged, "A.json", pickedSimilarKey); !slices.Equal(ids, []int{4, 3}) {
		t.Errorf("A.json pickedSimilar = %v, want [4 3] in the order picked", ids)
	}
	if a := staged[similarDir+"A.json"]; !strings.Contains(a, `"pickedSimilarNotes": {"4":"Same canal at night"}`) {
		t.Errorf("A.json = %s, want only the picked photo's trimmed note", a)
	}
}

func TestSetPickedSimilarErrors(t *testing.T) {
	tests := []struct {
		name   string
		picked PickedSimilar
		want   string
	}{
		{"not a photo file", PickedSimilar{Path: similarDir + "Z.json", IDs: []int{2}}, "isn't a photo file"},
		{"itself", PickedSimilar{Path: similarDir + "A.json", IDs: []int{1}}, "like itself"},
		{"twice", PickedSimilar{Path: similarDir + "A.json", IDs: []int{2, 2}}, "more than once"},
		{"unknown ID", PickedSimilar{Path: similarDir + "A.json", IDs: []int{99}}, "no photo with the ID 99"},
		{"long note", PickedSimilar{Path: similarDir + "A.json", IDs: []int{2}, Notes: map[string]string{"2": strings.Repeat("a", 281)}}, "longer than 280"},
		{"too many", PickedSimilar{Path: similarDir + "A.json", IDs: []int{2, 3, 4, 5, 6, 7, 8}}, "up to 6 photos"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := similarRepo()
			_, err := repo.start(t).SetPickedSimilar(t.Context(), baseURLSettings, tt.picked)
			var perr *PublishError
			if !errors.As(err, &perr) || !strings.Contains(perr.Message, tt.want) {
				t.Errorf("SetPickedSimilar() error = %v, want one containing %q", err, tt.want)
			}
			if staged := repo.staged(t); len(staged) != 0 {
				t.Errorf("pending = %v, want nothing", staged)
			}
		})
	}
}
