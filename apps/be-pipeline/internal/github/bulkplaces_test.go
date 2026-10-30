package github

import (
	"slices"
	"strings"
	"testing"
)

// bulkPlaceRepo starts a fake repo whose photo data pull request has photos,
// by file name, and the places Gyeongbokgung Palace and Gwangjang Market.
func bulkPlaceRepo(t *testing.T, photos map[string]string) (*fakeGitHub, *Client) {
	t.Helper()
	f, c := newFakeGitHub(t)
	files := map[string]string{
		photosDir + "ALLPHOTOS.json":                   "[]\n",
		dataRoot + "/places/gyeongbokgung-palace.json": `{"id":"gyeongbokgung-palace","name":"Gyeongbokgung Palace","description":"","parent":"","city":"Seoul","country":"South Korea"}`,
		dataRoot + "/places/gwangjang-market.json":     `{"id":"gwangjang-market","name":"Gwangjang Market","description":"","parent":"","city":"Seoul","country":"South Korea"}`,
	}
	for name, content := range photos {
		files[photosDir+name] = content
	}
	f.openPull(prBranch, files)
	return f, c
}

func TestPickBulkPlacePhotos(t *testing.T) {
	_, c := bulkPlaceRepo(t, map[string]string{
		"a.json": `{"places":[],"city":"Seoul","createDate":"2024:04:01 10:00:00"}`,
		"b.json": `{"places":[{"relation":"in","id":"gwangjang-market"}],"city":"Seoul"}`,
		"c.json": `{"places":[{"relation":"","id":""}],"city":"Seoul","createDate":"2024:04:01 12:00:00"}`,
		"d.json": `{"city":"Busan"}`,
	})
	got, err := c.PickBulkPlacePhotos(t.Context(), baseURLSettings, nil, 0)
	if err != nil {
		t.Fatalf("PickBulkPlacePhotos() error = %v", err)
	}
	var names []string
	for _, p := range got.Photos {
		names = append(names, p.Name)
	}
	// b has a place, so it's never picked; c's empty row isn't one. d shares
	// nothing with a.
	if want := []string{"a", "c"}; !slices.Equal(names, want) {
		t.Errorf("picked %v, want %v", names, want)
	}
	if got.Unplaced != 3 || got.PhotoFiles != 4 {
		t.Errorf("PickBulkPlacePhotos() = %+v, want 3 unplaced of 4 photo files", got)
	}
}

func TestApplyBulkPlaces(t *testing.T) {
	f, c := bulkPlaceRepo(t, map[string]string{
		"a.json": "{\n  \"placeName\": null,\n  \"places\": [],\n  \"customCity\": \"\"\n}\n",
		"b.json": "{\n  \"places\": []\n}\n",
	})
	lat, lng := 37.5796, 126.977
	got, err := c.ApplyBulkPlaces(t.Context(), baseURLSettings, BulkPlaces{
		NewPlaces: []Place{{ID: "geunjeongmun-gate", Name: "Geunjeongmun Gate", Parent: "gyeongbokgung-palace", Latitude: &lat, Longitude: &lng, ExactLocation: true}},
		Photos: []BulkPlacesPhoto{
			{Path: photosDir + "a.json", Places: []PhotoPlace{{Relation: "by", ID: "geunjeongmun-gate"}, {Relation: "in", ID: "gyeongbokgung-palace"}}, CustomCity: "Seoul"},
			{Path: photosDir + "b.json", Places: []PhotoPlace{{Relation: "at", ID: "gwangjang-market"}}},
		},
	})
	if err != nil {
		t.Fatalf("ApplyBulkPlaces() error = %v", err)
	}
	if got.NewPlaces != 1 || got.Photos != 2 || len(got.Changes) != 3 {
		t.Errorf("ApplyBulkPlaces() = %+v, want 1 new place and 2 photos", got)
	}
	if w := f.writes(); len(w) != 0 {
		t.Errorf("wrote to GitHub: %v", w)
	}
	gate, _ := stagedContent(t, c, dataRoot+"/places/geunjeongmun-gate.json")
	if !strings.Contains(gate.Content, `"parent": "gyeongbokgung-palace"`) || !strings.Contains(gate.Content, `"exactLocation": true`) {
		t.Errorf("geunjeongmun-gate.json = %s", gate.Content)
	}
	a, _ := stagedContent(t, c, photosDir+"a.json")
	for _, want := range []string{`"placeName": "Geunjeongmun Gate"`, `"customCity": "Seoul"`, `"relation": "by",` + "\n      \"id\": \"geunjeongmun-gate\""} {
		if !strings.Contains(a.Content, want) {
			t.Errorf("a.json = %s, want %s", a.Content, want)
		}
	}
	b, _ := stagedContent(t, c, photosDir+"b.json")
	if !strings.Contains(b.Content, `"placeName": "Gwangjang Market"`) || strings.Contains(b.Content, "customCity") {
		t.Errorf("b.json = %s, want the place name added and no custom city", b.Content)
	}
}

func TestApplyBulkPlacesErrors(t *testing.T) {
	_, c := bulkPlaceRepo(t, map[string]string{"a.json": `{"places":[{"relation":"at","id":"gwangjang-market"}],"placeName":"Gwangjang Market"}`})
	a := photosDir + "a.json"
	market := []PhotoPlace{{Relation: "at", ID: "gwangjang-market"}}
	tests := []struct {
		name string
		bulk BulkPlaces
		want string
	}{
		{"no photos", BulkPlaces{}, "1 to 50 photos"},
		{"not a place", BulkPlaces{Photos: []BulkPlacesPhoto{{Path: a, Places: []PhotoPlace{{ID: "nope"}}}}}, "isn't a place"},
		{"bad relation", BulkPlaces{Photos: []BulkPlacesPhoto{{Path: a, Places: []PhotoPlace{{Relation: ",", ID: "gwangjang-market"}}}}}, "relation"},
		{"no places", BulkPlaces{Photos: []BulkPlacesPhoto{{Path: a}}}, "one or two places"},
		{"taken name", BulkPlaces{NewPlaces: []Place{{ID: "x", Name: "gwangjang market"}}, Photos: []BulkPlacesPhoto{{Path: a, Places: market}}}, "already a place named"},
		{"missing parent", BulkPlaces{NewPlaces: []Place{{ID: "x", Name: "X", Parent: "y"}}, Photos: []BulkPlacesPhoto{{Path: a, Places: market}}}, "no place with the ID"},
		{"nothing new", BulkPlaces{Photos: []BulkPlacesPhoto{{Path: a, Places: market}}}, "nothing to change"},
		{"not a photo", BulkPlaces{Photos: []BulkPlacesPhoto{{Path: photosDir + "z.json", Places: market}}}, "isn't a photo file"},
		{"twice", BulkPlaces{Photos: []BulkPlacesPhoto{{Path: a, Places: market}, {Path: a, Places: market}}}, "more than once"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := c.ApplyBulkPlaces(t.Context(), baseURLSettings, tt.bulk)
			if err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Errorf("ApplyBulkPlaces() error = %v, want %q", err, tt.want)
			}
		})
	}
	if n := pendingCount(t, c); n != 0 {
		t.Errorf("pending = %d files, want none after errors", n)
	}
}
