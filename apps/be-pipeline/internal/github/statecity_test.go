package github

import (
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/exif"
)

const seoulLocalization = `{"id":"city-seoul","type":"city","name":"Seoul","romanization":"","pronunciation":"","localScript":"서울",
  "otherNames":["Seoul-si"]}`

func TestFillCityFromState(t *testing.T) {
	names := parseLocationNames([]Entry{{Data: []byte(seoulLocalization)}})
	tests := []struct {
		name             string
		in               exif.Sanitized
		city, customCity *string
	}{
		{"state", exif.Sanitized{State: ref("seoul")}, ref("Seoul"), nil},
		{"other name", exif.Sanitized{State: ref("Seoul-si")}, ref("Seoul"), nil},
		{"empty city", exif.Sanitized{State: ref("Seoul"), City: ref("")}, ref("Seoul"), nil},
		{"custom state", exif.Sanitized{State: ref("Seoul"), CustomState: ref("Seoul")}, nil, ref("Seoul")},
		{"custom state not a city", exif.Sanitized{State: ref("Seoul"), CustomState: ref("Gyeonggi")}, nil, nil},
		{"has a city", exif.Sanitized{State: ref("Seoul"), City: ref("Gangnam")}, ref("Gangnam"), nil},
		{"has a custom city", exif.Sanitized{State: ref("Seoul"), CustomCity: ref("Mapo")}, nil, ref("Mapo")},
		{"not a city", exif.Sanitized{State: ref("Alberta")}, nil, nil},
	}
	for _, tt := range tests {
		got := names.Apply(tt.in)
		if str(got.City) != str(tt.city) || str(got.CustomCity) != str(tt.customCity) {
			t.Errorf("%s: Apply() city = %q, customCity = %q", tt.name, str(got.City), str(got.CustomCity))
		}
	}
}

func str(s *string) string {
	if s == nil {
		return "<nil>"
	}
	return *s
}

func TestApplyLocationNamesFillsCity(t *testing.T) {
	photos := dataRoot + "/photos/"
	_, c := newMainRepo(t, map[string]string{
		dataRoot + "/localizations/city-seoul.json": seoulLocalization,
		photos + "a.json": "{\n  \"customCity\": null,\n  \"state\": \"Seoul\",\n  \"city\": null\n}\n",
		photos + "b.json": "{\n  \"state\": \"Seoul\",\n  \"city\": \"Seoul\"\n}\n",
		photos + "c.json": "{\n  \"customState\": \"Seoul-si\"\n}\n",
		photos + "d.json": "{\n  \"state\": \"Alberta\",\n  \"city\": null\n}\n",
	})
	preview, err := c.PreviewLocationNames(t.Context(), placesGH)
	if err != nil {
		t.Fatalf("PreviewLocationNames() error = %v", err)
	}
	if len(preview.Files) != 2 || preview.Files[0].Changes[0].Field != "city" || preview.Files[1].Changes[0].Field != "customCity" {
		t.Fatalf("preview files = %+v, want a.json's city and c.json's custom city", preview.Files)
	}
	if _, err := c.ApplyLocationNames(t.Context(), placesGH); err != nil {
		t.Fatalf("ApplyLocationNames() error = %v", err)
	}
	want := "{\n  \"customCity\": null,\n  \"state\": \"Seoul\",\n  \"city\": \"Seoul\"\n}\n"
	if a := staged(t, c, photos+"a.json"); a != want {
		t.Errorf("a.json = %q", a)
	}
	if cJSON := staged(t, c, photos+"c.json"); cJSON != "{\n  \"customState\": \"Seoul-si\",\n  \"customCity\": \"Seoul\"\n}\n" {
		t.Errorf("c.json = %q", cJSON)
	}
}
