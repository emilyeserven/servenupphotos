package github

import (
	"strings"
	"testing"
)

func TestCasualPhotos(t *testing.T) {
	casual := dataRoot + "/photos/f.json"
	files := with(emptyLists, with(tripPhotos, map[string]string{
		casual: `{"id":15,"title":"Ramen","casual":true,"createDate":"2026:09:23 09:30:00","gpsPosition":"35.0005, 135.7505","width":400,"height":300,"images":{"medium":"https://cdn.example/f-medium.webp"}}`,
	}))
	f, c := newMainRepo(t, files)
	line := TripLine{ID: "2026-09-23", Segments: []TripSegment{{Mode: ModeWalk, Photos: []int{10, 11}}}, Visits: []TripVisit{
		{Name: "Ramen shop", Kind: "restaurant", Latitude: 35, Longitude: 135.75, Photos: []int{15, 10}},
		{Name: "Nothing casual", Kind: "shop", Latitude: 35, Longitude: 135.75, Photos: []int{11}},
	}}
	if _, err := c.SaveTripLine(t.Context(), placesGH, line); err != nil {
		t.Fatalf("SaveTripLine() error = %v", err)
	}
	if _, err := c.SaveTripStory(t.Context(), placesGH, TripStory{ID: "story-2026-09-23", Photos: []StoryPhoto{{ID: 10}}}); err != nil {
		t.Fatalf("SaveTripStory() error = %v", err)
	}
	if _, err := c.SaveTripLine(t.Context(), placesGH, TripLine{ID: "2026-09-23", Segments: []TripSegment{{Mode: ModeWalk, Photos: []int{10, 15}}}}); err == nil {
		t.Error("a line through a casual photo saved")
	}
	if _, err := c.CommitCombined(t.Context(), pullGH, nil); err != nil {
		t.Fatalf("CommitCombined() error = %v", err)
	}
	tree := f.committedTree()
	if all := tree[dataRoot+"/photos/"+AllPhotosFile]; strings.Contains(all, `"Ramen"`) {
		t.Errorf("%s has the casual photo:\n%s", AllPhotosFile, all)
	}
	pages := tree[dataRoot+"/triplines/"+TripPagesFile]
	for _, want := range []string{`"name": "Ramen shop"`, `"id": 15`, `f-medium.webp`, `"width": 400`} {
		if !strings.Contains(pages, want) {
			t.Errorf("%s has no %s:\n%s", TripPagesFile, want, pages)
		}
	}
	if strings.Contains(pages, "Nothing casual") {
		t.Errorf("a place with no casual photo is on the page:\n%s", pages)
	}
}
