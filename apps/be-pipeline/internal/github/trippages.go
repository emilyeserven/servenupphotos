package github

import (
	"encoding/json"
	"net/http"
	"sort"
	"strings"
)

// TripPagesFile is the days' stories baked for the portfolio's Trip pages:
// one page per Trip with a story on any of its days, with those days' stories
// in order, and one page for each day with a story in no Trip. Commit makes it
// in the trip lines folder, next to TRIPLINES.json, and the combined list
// leaves it out (see isDataFile), so the portfolio reads only the stories and
// not every line's path.
const TripPagesFile = "TRIPPAGES.json"

// dayPagePrefix starts the ID of the Trip page of a day in no Trip, such as
// "day-2026-10-01".
const dayPagePrefix = "day-"

// tripPage is one Trip page of TripPagesFile.
type tripPage struct {
	// ID is the Trip's ID, or "day-" and the day for a day in no Trip; the
	// page's address on the portfolio.
	ID string `json:"id"`
	// Name is the Trip's name; "" for a day in no Trip, which the portfolio
	// names after the day.
	Name string `json:"name"`
	// Start and End are the Trip's first and last days, or the day.
	Start string `json:"start"`
	End   string `json:"end"`
	// Days are the stories of the days with one, in order.
	Days []tripPageDay `json:"days"`
}

// tripPageDay is one day's story on a Trip page.
type tripPageDay struct {
	Day    string       `json:"day"`
	Intro  string       `json:"intro,omitempty"`
	Photos []StoryPhoto `json:"photos"`
	// Stops are the day's trip stops with casual photos (see
	// tripStop); none when it has none.
	Stops []tripStop `json:"stops,omitempty"`
}

// addTripPages bakes TripPagesFile from the story and Trip files with
// changes made, adds it to changes when it differs from the one at the head,
// and counts its pages in counts. The portfolio leaves out the photos it
// doesn't have, such as drafts.
func (w *workspace) addTripPages(changes map[string][]byte, counts map[string]int) *PublishError {
	view := w.withChanges(changes)
	places := pageStops(view.tripLineFiles(), view.casualPhotos())
	pages := bakeTripPages(storiesIn(view.entries(TripLines)), view.allTrips(), places)
	b, err := json.Marshal(pages)
	if err != nil {
		return publishErr(http.StatusInternalServerError, "Couldn't format %s.", TripPagesFile)
	}
	content := formatJSONFile(b)
	counts["tripPages"] = len(pages)
	file := w.root + "/" + TripLines.Folder + "/" + TripPagesFile
	if old, ok := w.head.files[file]; !ok || old.sha != blobSHA(content) {
		changes[file] = content
	}
	return nil
}

// storiesIn is the days' stories among entries that can be read.
func storiesIn(entries []Entry) []TripStory {
	var out []TripStory
	for _, e := range entries {
		var story TripStory
		if e.Error == "" && json.Unmarshal(e.Data, &story) == nil && strings.HasPrefix(story.ID, storyIDPrefix) && story.Date != "" {
			out = append(out, story)
		}
	}
	return out
}

// bakeTripPages is the Trip pages of stories, newest first: each Trip with
// a story on one of its days, then a page for each day in no Trip. Each day
// has its places with casual photos, by day.
func bakeTripPages(stories []TripStory, trips []Trip, places map[string][]tripStop) []tripPage {
	sort.Slice(stories, func(i, j int) bool { return stories[i].Date < stories[j].Date })
	byID := map[string]*tripPage{}
	var order []string
	for _, s := range stories {
		page := pageOf(s.Date, trips)
		if byID[page.ID] == nil {
			byID[page.ID] = &page
			order = append(order, page.ID)
		}
		p := byID[page.ID]
		p.Days = append(p.Days, tripPageDay{Day: s.Date, Intro: s.Intro, Photos: s.Photos, Stops: places[s.Date]})
	}
	pages := make([]tripPage, 0, len(order))
	for _, id := range order {
		pages = append(pages, *byID[id])
	}
	sort.SliceStable(pages, func(i, j int) bool { return pages[i].Start > pages[j].Start })
	return pages
}

// pageOf is the empty Trip page day goes on: its Trip's, or else its own.
func pageOf(day string, trips []Trip) tripPage {
	for _, t := range trips {
		if inTrip(t, day) {
			return tripPage{ID: t.ID, Name: t.Name, Start: t.Start, End: t.End}
		}
	}
	return tripPage{ID: dayPagePrefix + day, Start: day, End: day}
}
