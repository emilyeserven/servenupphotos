package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"
)

func TestSaveTripStory(t *testing.T) {
	_, c := newMainRepo(t, tripPhotos)
	story := TripStory{ID: "story-2026-09-23", Intro: " Off early. ", Photos: []StoryPhoto{
		{ID: 10, Text: " The gate ", WithNext: true},
		{ID: 14, UseComment: true, Text: "dropped", TextSide: TextLeft},
		{ID: 11, After: "Then the **station**.", WithNext: false},
		{ID: 12, WithNext: true},
	}}
	if _, err := c.SaveTripStory(t.Context(), placesGH, story); err != nil {
		t.Fatalf("SaveTripStory() error = %v", err)
	}
	saved := staged(t, c, dataRoot+"/triplines/story-2026-09-23.json")
	for _, want := range []string{`"date": "2026-09-23"`, `"intro": "Off early."`, `"text": "The gate"`, `"useComment": true`, `"textSide": "left"`, `"withNext": true`} {
		if !strings.Contains(saved, want) {
			t.Errorf("saved %s, want %s", saved, want)
		}
	}
	if strings.Contains(saved, "dropped") {
		t.Errorf("text kept beside useComment: %s", saved)
	}
	if strings.Count(saved, `"withNext"`) != 1 {
		t.Errorf("the last photo kept withNext: %s", saved)
	}
	five := make([]StoryPhoto, 5)
	for i := range five {
		five[i] = StoryPhoto{ID: 10 + i, WithNext: true}
	}
	tests := []struct {
		name  string
		story TripStory
	}{
		{"no prefix", TripStory{ID: "2026-09-23"}},
		{"not a day", TripStory{ID: "story-sept"}},
		{"other day", TripStory{ID: "story-2026-09-23", Photos: []StoryPhoto{{ID: 13}}}},
		{"unknown photo", TripStory{ID: "story-2026-09-23", Photos: []StoryPhoto{{ID: 99}}}},
		{"twice", TripStory{ID: "story-2026-09-23", Photos: []StoryPhoto{{ID: 10}, {ID: 10}}}},
		{"row and paragraph", TripStory{ID: "story-2026-09-23", Photos: []StoryPhoto{{ID: 10, WithNext: true, After: "x"}, {ID: 11}}}},
		{"row of five", TripStory{ID: "story-2026-09-23", Photos: five}},
		{"bad side", TripStory{ID: "story-2026-09-23", Photos: []StoryPhoto{{ID: 10, TextSide: "above"}}}},
	}
	for _, tt := range tests {
		_, err := c.SaveTripStory(t.Context(), placesGH, tt.story)
		var perr *PublishError
		if !errors.As(err, &perr) || perr.Status != http.StatusBadRequest {
			t.Errorf("%s: SaveTripStory() error = %v, want 400", tt.name, err)
		}
	}
	if _, err := c.DeleteTripStory(t.Context(), placesGH, "2026-09-23"); err == nil {
		t.Error("DeleteTripStory() of a day's line: no error")
	}
	if _, err := c.DeleteTripStory(t.Context(), placesGH, "story-2026-09-23"); err != nil {
		t.Errorf("DeleteTripStory() error = %v", err)
	}
}

func TestStoryIsNotALine(t *testing.T) {
	files := map[string]string{}
	for k, v := range tripPhotos {
		files[k] = v
	}
	files[dataRoot+"/triplines/story-2026-09-23.json"] = `{"id":"story-2026-09-23","date":"2026-09-23","photos":[{"id":10}]}`
	_, c := newMainRepo(t, files)
	w, perr := c.workspace(t.Context(), placesGH)
	if perr != nil {
		t.Fatal(perr)
	}
	if lines := w.tripLineFiles(); len(lines) != 0 {
		t.Errorf("tripLineFiles() = %+v; a story was read as a line", lines)
	}
	if trips := tripsIn(w.entries(TripLines)); len(trips) != 0 {
		t.Errorf("tripsIn() = %+v; a story was read as a Trip", trips)
	}
}

func TestBakeTripPages(t *testing.T) {
	stories := []TripStory{
		{ID: "story-2026-09-24", Date: "2026-09-24", Photos: []StoryPhoto{{ID: 13}}},
		{ID: "story-2026-10-01", Date: "2026-10-01", Intro: "Home again."},
		{ID: "story-2026-09-23", Date: "2026-09-23", Photos: []StoryPhoto{{ID: 10, Text: "Gate"}}},
	}
	pages := bakeTripPages(stories, []Trip{tripKorea}, nil)
	if len(pages) != 2 {
		t.Fatalf("pages = %+v, want 2", pages)
	}
	day, trip := pages[0], pages[1]
	if day.ID != "day-2026-10-01" || day.Name != "" || day.Start != "2026-10-01" || len(day.Days) != 1 {
		t.Errorf("day page = %+v", day)
	}
	if trip.ID != "trip-kyoto" || len(trip.Days) != 2 || trip.Days[0].Day != "2026-09-23" || trip.Days[0].Photos[0].Text != "Gate" {
		t.Errorf("Trip page = %+v", trip)
	}
}
