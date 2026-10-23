package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/exif"
)

const usaLocalization = `{"id":"country-united-states-of-america","type":"country","name":"United States of America",
  "romanization":"","pronunciation":"","localScript":"","otherNames":["United States","USA"]}`

func TestLocationNamesApply(t *testing.T) {
	names := parseLocationNames([]Entry{{Data: []byte(usaLocalization)}})
	got := names.Apply(exif.Sanitized{Country: ref(" usa "), CustomCountry: ref("Canada"), City: ref("United States")})
	if *got.Country != "United States of America" || *got.CustomCountry != "Canada" || *got.City != "United States" {
		t.Errorf("Apply() = %v, %v, %v", *got.Country, *got.CustomCountry, *got.City)
	}
}

func TestSaveLocalizationOtherNames(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{
		dataRoot + "/localizations/country-united-states-of-america.json": usaLocalization,
	})
	l := Localization{ID: "country-america", Type: "country", Name: "America", OtherNames: []string{" US ", "us", "America", ""}}
	if _, err := c.SaveLocalization(t.Context(), placesGH, l); err != nil {
		t.Fatalf("SaveLocalization() error = %v", err)
	}
	if saved := staged(t, c, dataRoot+"/localizations/country-america.json"); !strings.Contains(saved, "\"otherNames\": [\n    \"US\"\n  ]") {
		t.Errorf("saved %s, want only US as another name", saved)
	}

	tests := []struct {
		name string
		l    Localization
	}{
		{"taken", Localization{ID: "country-us", Type: "country", Name: "US", OtherNames: []string{"usa"}}},
		{"is another's", Localization{ID: "country-usa", Type: "country", Name: "USA", OtherNames: []string{"U.S.A."}}},
		{"has its own", Localization{ID: "country-america-2", Type: "country", Name: "The States", OtherNames: []string{"United States of America"}}},
	}
	for _, tt := range tests {
		_, err := c.SaveLocalization(t.Context(), placesGH, tt.l)
		var perr *PublishError
		if !errors.As(err, &perr) || perr.Status != http.StatusConflict {
			t.Errorf("%s: SaveLocalization() error = %v, want a conflict", tt.name, err)
		}
	}
	place := Localization{ID: "place-a", Type: "place", Name: "A", OtherNames: []string{"B"}}
	if _, err := c.SaveLocalization(t.Context(), placesGH, place); err == nil {
		t.Error("SaveLocalization() saved a place's other names")
	}
}

func TestApplyLocationNames(t *testing.T) {
	photos := dataRoot + "/photos/"
	_, c := newMainRepo(t, map[string]string{
		dataRoot + "/localizations/country-united-states-of-america.json": usaLocalization,
		photos + "a.json":                "{\n  \"country\": \"USA\",\n  \"customCountry\": \"United States\",\n  \"city\": \"Boston\"\n}\n",
		photos + "b.json":                "{\n  \"country\": \"United States of America\"\n}\n",
		dataRoot + "/places/fenway.json": "{\n  \"id\": \"fenway\",\n  \"name\": \"Fenway Park\",\n  \"country\": \"united states\"\n}\n",
	})
	preview, err := c.PreviewLocationNames(t.Context(), placesGH)
	if err != nil {
		t.Fatalf("PreviewLocationNames() error = %v", err)
	}
	if preview.PhotoFiles != 2 || preview.PlaceFiles != 1 || preview.OtherNames != 2 || len(preview.Files) != 2 {
		t.Fatalf("preview = %+v, want a.json and the place", preview)
	}
	if len(preview.Files[0].Changes) != 2 || preview.Files[1].Kind != "place" {
		t.Errorf("files = %+v", preview.Files)
	}

	result, err := c.ApplyLocationNames(t.Context(), placesGH)
	if err != nil {
		t.Fatalf("ApplyLocationNames() error = %v", err)
	}
	if result.Files != 2 || result.Fields != 3 {
		t.Errorf("ApplyLocationNames() = %+v, want 3 fields in 2 files", result)
	}
	want := "{\n  \"country\": \"United States of America\",\n  \"customCountry\": \"United States of America\",\n  \"city\": \"Boston\"\n}\n"
	if a := staged(t, c, photos+"a.json"); a != want {
		t.Errorf("a.json = %q", a)
	}
	if place := staged(t, c, dataRoot+"/places/fenway.json"); !strings.Contains(place, `"country": "United States of America"`) {
		t.Errorf("fenway.json = %s", place)
	}
	if _, err := c.ApplyLocationNames(t.Context(), placesGH); err == nil {
		t.Error("ApplyLocationNames() again saved changes, want none")
	}
}
