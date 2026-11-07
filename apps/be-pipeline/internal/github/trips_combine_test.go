package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"
)

func TestTripLabels(t *testing.T) {
	_, c := newMainRepo(t, tripPhotos)
	trip := Trip{ID: "kj", Name: "Korea and Japan", Start: "2026-09-20", End: "2026-10-02", Labels: []TripLabel{
		{Name: " Korea ", Start: "2026-09-20", End: "2026-09-21"},
		{Name: "Japan", Start: "2026-09-22", End: "2026-10-02"},
	}}
	if _, err := c.SaveTrip(t.Context(), placesGH, trip); err != nil {
		t.Fatalf("SaveTrip() error = %v", err)
	}
	if saved := staged(t, c, dataRoot+"/timeline/kj.json"); !strings.Contains(saved, `"name": "Korea"`) {
		t.Errorf("saved %s", saved)
	}
	bad := func(labels ...TripLabel) Trip {
		out := trip
		out.Labels = labels
		return out
	}
	for name, tt := range map[string]Trip{
		"no name":  bad(TripLabel{Start: "2026-09-20", End: "2026-09-21"}),
		"outside":  bad(TripLabel{Name: "X", Start: "2026-09-19", End: "2026-09-21"}),
		"overlaps": bad(TripLabel{Name: "A", Start: "2026-09-20", End: "2026-09-22"}, TripLabel{Name: "B", Start: "2026-09-22", End: "2026-09-23"}),
	} {
		var perr *PublishError
		if _, err := c.SaveTrip(t.Context(), placesGH, tt); !errors.As(err, &perr) || perr.Status != http.StatusBadRequest {
			t.Errorf("%s: SaveTrip() error = %v, want 400", name, err)
		}
	}
}

func TestCombineTrips(t *testing.T) {
	_, c := newMainRepo(t, with(tripPhotos, map[string]string{
		dataRoot + "/timeline/korea.json":       `{"id":"korea","name":"Korea","start":"2026-09-20","end":"2026-09-21"}`,
		dataRoot + "/timeline/japan.json":       `{"id":"japan","name":"Japan","start":"2026-09-22","end":"2026-10-02"}`,
		dataRoot + "/timeline/home.json":        `{"id":"home","name":"Home","start":"2026-10-03","end":"2026-10-05"}`,
		dataRoot + "/timeline/later.json":       `{"id":"later","name":"Later","start":"2026-11-01","end":"2026-11-02"}`,
		dataRoot + "/triplines/trip-osaka.json": `{"id":"trip-osaka","name":"Osaka","start":"2026-10-06","end":"2026-10-07","legs":[]}`,
	}))
	combined := Trip{ID: "korea", Name: "Korea and Japan", Start: "2026-09-20", End: "2026-10-02", Labels: []TripLabel{
		{Name: "Korea", Start: "2026-09-20", End: "2026-09-21"},
		{Name: "Japan", Start: "2026-09-22", End: "2026-10-02"},
	}}
	got, err := c.CombineTrips(t.Context(), placesGH, combined, []string{"korea", "japan"})
	if err != nil {
		t.Fatalf("CombineTrips() error = %v", err)
	}
	if len(got.Changes) != 2 {
		t.Errorf("changes = %+v, want the combined Trip saved and Japan removed", got.Changes)
	}
	if f, _ := stagedContent(t, c, dataRoot+"/timeline/japan.json"); !f.Deleted {
		t.Error("Japan wasn't removed")
	}
	if saved := staged(t, c, dataRoot+"/timeline/korea.json"); !strings.Contains(saved, "Korea and Japan") {
		t.Errorf("saved %s", saved)
	}
	// A Trip saved before in the trip lines folder can be combined too.
	both := Trip{ID: "home-osaka", Name: "Home and Osaka", Start: "2026-10-03", End: "2026-10-07"}
	if _, err := c.CombineTrips(t.Context(), placesGH, both, []string{"home", "trip-osaka"}); err != nil {
		t.Fatalf("CombineTrips() with a Trip from before: error = %v", err)
	}
	if f, _ := stagedContent(t, c, dataRoot+"/triplines/trip-osaka.json"); !f.Deleted {
		t.Error("the Trip from before wasn't removed")
	}
	for name, tt := range map[string]struct {
		trip Trip
		ids  []string
		want int
	}{
		"one":      {both, []string{"home-osaka"}, http.StatusBadRequest},
		"missing":  {both, []string{"home-osaka", "nope"}, http.StatusNotFound},
		"overlaps": {Trip{ID: "x", Name: "X", Start: "2026-09-20", End: "2026-11-02"}, []string{"korea", "later"}, http.StatusConflict},
	} {
		var perr *PublishError
		if _, err := c.CombineTrips(t.Context(), placesGH, tt.trip, tt.ids); !errors.As(err, &perr) || perr.Status != tt.want {
			t.Errorf("%s: CombineTrips() error = %v, want %d", name, err, tt.want)
		}
	}
}
