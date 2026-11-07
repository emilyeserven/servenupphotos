package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"
)

// tripKorea is a Trip over the trip line test photos' two days: a ferry
// between them, and a flight home from the second day.
var tripKorea = Trip{ID: "trip-kyoto", Name: " Kyoto ", Start: "2026-09-23", End: "2026-09-24", Legs: []TripLeg{
	{Mode: ModeFerry, From: TripLegEnd{Day: "2026-09-23"}, To: TripLegEnd{Day: "2026-09-24"}},
	{Mode: ModeFlight, From: TripLegEnd{Day: "2026-09-24"}, To: TripLegEnd{Day: "2026-09-24", Spot: &TripPoint{Latitude: 40.7, Longitude: -74, Label: "Home"}}},
}}

func TestSaveTrip(t *testing.T) {
	_, c := newMainRepo(t, tripPhotos)
	if _, err := c.SaveTrip(t.Context(), placesGH, tripKorea); err != nil {
		t.Fatalf("SaveTrip() error = %v", err)
	}
	saved := staged(t, c, dataRoot+"/triplines/trip-kyoto.json")
	if !strings.Contains(saved, `"name": "Kyoto"`) || !strings.Contains(saved, `"mode": "ferry"`) {
		t.Errorf("saved %s", saved)
	}
	leg := func(mode, from, to string) Trip {
		trip := tripKorea
		trip.ID = "trip-other"
		trip.Start, trip.End = "2026-10-01", "2026-10-05"
		trip.Legs = []TripLeg{{Mode: mode, From: TripLegEnd{Day: from}, To: TripLegEnd{Day: to}}}
		return trip
	}
	tests := []struct {
		name   string
		trip   Trip
		status int
	}{
		{"no prefix", Trip{ID: "kyoto", Name: "Kyoto", Start: "2026-09-23", End: "2026-09-24"}, http.StatusBadRequest},
		{"no name", Trip{ID: "trip-x", Start: "2026-09-23", End: "2026-09-24"}, http.StatusBadRequest},
		{"backwards", Trip{ID: "trip-x", Name: "X", Start: "2026-09-24", End: "2026-09-23"}, http.StatusBadRequest},
		{"bad mode", leg("walk", "2026-10-01", "2026-10-02"), http.StatusBadRequest},
		{"outside", leg(ModeFerry, "2026-10-01", "2026-10-09"), http.StatusBadRequest},
		{"arrives first", leg(ModeFerry, "2026-10-03", "2026-10-02"), http.StatusBadRequest},
		{"overlaps", Trip{ID: "trip-x", Name: "X", Start: "2026-09-24", End: "2026-09-30"}, http.StatusConflict},
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
	if _, err := c.DeleteTrip(t.Context(), placesGH, "2026-09-23"); err == nil {
		t.Error("DeleteTrip() of a day's line: no error")
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
	for _, want := range []string{`"mode": "ferry"`, `"trip": "trip-kyoto"`, `"arrive": "2026-09-24"`, `"photos": [12, 13]`, `[135.9, 35.1]`, `"mode": "flight"`, `"end": "Home"`} {
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
