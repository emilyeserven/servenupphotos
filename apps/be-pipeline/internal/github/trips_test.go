package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"
)

// tripKorea is a Trip over the trip line test photos' two days: a ferry
// between them, and a flight home from the second day.
var tripKorea = Trip{ID: "kyoto", Name: " Kyoto ", Start: "2026-09-23", End: "2026-09-24", Legs: []TripLeg{
	{Mode: ModeFerry, From: TripLegEnd{Day: "2026-09-23"}, To: TripLegEnd{Day: "2026-09-24"}},
	{Mode: ModeFlight, From: TripLegEnd{Day: "2026-09-24"}, To: TripLegEnd{Day: "2026-09-24", Spot: &TripPoint{Latitude: 40.7, Longitude: -74, Label: "Home"}}},
}}

func TestSaveTrip(t *testing.T) {
	_, c := newMainRepo(t, with(tripPhotos, map[string]string{
		dataRoot + "/timeline/seoul.json": `{"id":"seoul","name":"Seoul","start":"2026-08-01","end":"2026-08-03"}`,
	}))
	if _, err := c.SaveTrip(t.Context(), placesGH, tripKorea); err != nil {
		t.Fatalf("SaveTrip() error = %v", err)
	}
	saved := staged(t, c, dataRoot+"/timeline/kyoto.json")
	if !strings.Contains(saved, `"name": "Kyoto"`) || !strings.Contains(saved, `"mode": "ferry"`) {
		t.Errorf("saved %s", saved)
	}
	leg := func(mode, from, to string) Trip {
		trip := tripKorea
		trip.ID = "other"
		trip.Start, trip.End = "2026-10-01", "2026-10-05"
		trip.Legs = []TripLeg{{Mode: mode, From: TripLegEnd{Day: from}, To: TripLegEnd{Day: to}}}
		return trip
	}
	tests := []struct {
		name   string
		trip   Trip
		status int
	}{
		{"bad ID", Trip{ID: "A A", Name: "A", Start: "2026-01-01", End: "2026-01-01"}, http.StatusBadRequest},
		{"no name", Trip{ID: "x", Start: "2026-09-23", End: "2026-09-24"}, http.StatusBadRequest},
		{"not a date", Trip{ID: "x", Name: "X", Start: "Sept 1", End: "2026-09-24"}, http.StatusBadRequest},
		{"backwards", Trip{ID: "x", Name: "X", Start: "2026-09-24", End: "2026-09-23"}, http.StatusBadRequest},
		{"bad mode", leg("walk", "2026-10-01", "2026-10-02"), http.StatusBadRequest},
		{"outside", leg(ModeFerry, "2026-10-01", "2026-10-09"), http.StatusBadRequest},
		{"arrives first", leg(ModeFerry, "2026-10-03", "2026-10-02"), http.StatusBadRequest},
		{"overlaps", Trip{ID: "x", Name: "X", Start: "2026-09-24", End: "2026-09-30"}, http.StatusConflict},
		{"overlaps a label", Trip{ID: "x", Name: "X", Start: "2026-08-02", End: "2026-08-02"}, http.StatusConflict},
	}
	for _, tt := range tests {
		_, err := c.SaveTrip(t.Context(), placesGH, tt.trip)
		var perr *PublishError
		if !errors.As(err, &perr) || perr.Status != tt.status {
			t.Errorf("%s: SaveTrip() error = %v, want status %d", tt.name, err, tt.status)
		}
	}
	// Skipping days is fine.
	if _, err := c.SaveTrip(t.Context(), placesGH, leg(ModeFlight, "2026-10-01", "2026-10-05")); err != nil {
		t.Errorf("skipping days: SaveTrip() error = %v", err)
	}
	// A Trip with no legs, as a timeline label was, leaves legs out of its file.
	if _, err := c.SaveTrip(t.Context(), placesGH, Trip{ID: "busan", Name: "Busan", Start: "2026-11-01", End: "2026-11-01"}); err != nil {
		t.Fatalf("no legs: SaveTrip() error = %v", err)
	}
	if saved := staged(t, c, dataRoot+"/timeline/busan.json"); strings.Contains(saved, "legs") {
		t.Errorf("no legs: saved %s", saved)
	}
	// Saving it again over its own days isn't an overlap.
	if _, err := c.SaveTrip(t.Context(), placesGH, tripKorea); err != nil {
		t.Errorf("resave: SaveTrip() error = %v", err)
	}
	if _, err := c.DeleteTrip(t.Context(), placesGH, "2026-09-23"); err == nil {
		t.Error("DeleteTrip() of a day's line: no error")
	}
}

func TestLegacyTrip(t *testing.T) {
	legacy := `{"id":"trip-kyoto","name":"Kyoto","start":"2026-09-23","end":"2026-09-24","legs":[]}`
	_, c := newMainRepo(t, with(tripPhotos, map[string]string{dataRoot + "/triplines/trip-kyoto.json": legacy}))
	w, perr := c.workspace(t.Context(), placesGH)
	if perr != nil {
		t.Fatal(perr)
	}
	if trips := w.allTrips(); len(trips) != 1 || trips[0].ID != "trip-kyoto" {
		t.Fatalf("allTrips() = %+v, want the Trip saved in the trip lines folder", trips)
	}
	// Its days are taken, so another Trip can't have them.
	_, err := c.SaveTrip(t.Context(), placesGH, Trip{ID: "x", Name: "X", Start: "2026-09-24", End: "2026-09-24"})
	var perr2 *PublishError
	if !errors.As(err, &perr2) || perr2.Status != http.StatusConflict {
		t.Errorf("overlap: SaveTrip() error = %v, want 409", err)
	}
	// Saving it moves it to the timeline folder.
	trip := tripKorea
	trip.ID = "trip-kyoto"
	if _, err := c.SaveTrip(t.Context(), placesGH, trip); err != nil {
		t.Fatalf("SaveTrip() error = %v", err)
	}
	staged(t, c, dataRoot+"/timeline/trip-kyoto.json")
	if f, _ := stagedContent(t, c, dataRoot+"/triplines/trip-kyoto.json"); !f.Deleted {
		t.Error("the trip lines folder's copy wasn't removed")
	}
}

func TestCommitCombinedBakesTrips(t *testing.T) {
	f, c := newMainRepo(t, with(emptyLists, tripPhotos))
	if _, err := c.SaveTrip(t.Context(), placesGH, tripKorea); err != nil {
		t.Fatalf("SaveTrip() error = %v", err)
	}
	got, err := c.CommitCombined(t.Context(), pullGH, nil)
	if err != nil {
		t.Fatalf("CommitCombined() error = %v", err)
	}
	if got.Counts["tripLegs"] != 2 || got.Counts["tripLineSegments"] != 0 {
		t.Errorf("counts = %v", got.Counts)
	}
	baked := f.committedTree()[dataRoot+"/triplines/"+TripLinesMapFile]
	// The ferry leaves from Sep 23's last photo (12, at the station) and
	// arrives at Sep 24's first (13).
	for _, want := range []string{`"mode": "ferry"`, `"trip": "kyoto"`, `"arrive": "2026-09-24"`, `"photos": [12, 13]`, `[135.9, 35.1]`, `"mode": "flight"`, `"end": "Home"`} {
		if !strings.Contains(baked, want) {
			t.Errorf("baked map has no %s:\n%s", want, baked)
		}
	}
}

func TestNearSideAndArc(t *testing.T) {
	// Tokyo to New York crosses the date line rather than going around the world.
	to := nearSide([2]float64{139.7, 35.7}, [2]float64{-74, 40.7})
	if to[0] != 286 {
		t.Errorf("nearSide() = %v, want longitude 286", to)
	}
	line := arc([2]float64{0, 0}, [2]float64{10, 0})
	if len(line) != arcPoints+1 || line[0] != [2]float64{0, 0} || line[arcPoints] != [2]float64{10, 0} {
		t.Fatalf("arc() ends = %v, %v (%d points)", line[0], line[arcPoints], len(line))
	}
	if mid := line[arcPoints/2]; mid[1] <= 0 {
		t.Errorf("arc() middle %v doesn't bow north", mid)
	}
	// Westward in the north, and eastward in the south, bow toward their poles too.
	if mid := arc([2]float64{10, 40}, [2]float64{0, 40})[arcPoints/2]; mid[1] <= 40 {
		t.Errorf("westward arc() middle %v doesn't bow north", mid)
	}
	if mid := arc([2]float64{0, -30}, [2]float64{10, -30})[arcPoints/2]; mid[1] >= -30 {
		t.Errorf("southern arc() middle %v doesn't bow south", mid)
	}
}

func TestLegEndPhoto(t *testing.T) {
	spots := map[int]tripSpot{
		10: {ID: 10, Day: "2026-09-23", Longitude: 135.7, Latitude: 35},
		12: {ID: 12, Day: "2026-09-23", Longitude: 135.9, Latitude: 35.1},
		13: {ID: 13, Day: "2026-09-24", Longitude: 136, Latitude: 35.2},
	}
	// Leaving with no photo named uses the day's last; naming one uses it,
	// so a day can have legs from different spots.
	if _, _, id, _ := legEnd(TripLegEnd{Day: "2026-09-23"}, spots, true); id != 12 {
		t.Errorf("default leaving photo = %d, want 12", id)
	}
	if _, _, id, _ := legEnd(TripLegEnd{Day: "2026-09-23", Photo: 10}, spots, true); id != 10 {
		t.Errorf("named leaving photo = %d, want 10", id)
	}
	// A photo from another day is ignored.
	if _, _, id, _ := legEnd(TripLegEnd{Day: "2026-09-23", Photo: 13}, spots, true); id != 12 {
		t.Errorf("other day's photo = %d, want 12", id)
	}
}
