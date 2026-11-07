package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"
)

func TestSavePlaceArea(t *testing.T) {
	_, c := newMainRepo(t, tripPhotos)
	saved, err := c.SavePlaceArea(t.Context(), placesGH, "station", PlaceArea{OSM: " R1 ", Shape: square})
	if err != nil {
		t.Fatal(err)
	}
	file := dataRoot + "/places/station.geo.json"
	content := staged(t, c, file)
	if saved.Path != file || !strings.Contains(content, `"type": "Feature"`) || !strings.Contains(content, `"place": "station"`) || !strings.Contains(content, `"osm": "R1"`) {
		t.Errorf("saved %s: %s", saved.Path, content)
	}
	if pendingCount(t, c) != 1 {
		t.Errorf("pending = %d, want the area waiting for Commit", pendingCount(t, c))
	}
	area, err := c.PlaceAreaOf(t.Context(), placesGH, "station")
	if err != nil || area == nil || area.OSM != "R1" || len(area.Shape) != 1 {
		t.Fatalf("PlaceAreaOf() = %+v, %v", area, err)
	}
	if isDataFile(dataRoot+"/places", file, Places.AllFile) {
		t.Error("an area file would go in PLACES.json")
	}
	if _, err := c.DeletePlaceArea(t.Context(), placesGH, "station"); err != nil {
		t.Fatal(err)
	}
	if area, err := c.PlaceAreaOf(t.Context(), placesGH, "station"); err != nil || area != nil {
		t.Errorf("after removing: %+v, %v", area, err)
	}
}

func TestSavePlaceAreaRefused(t *testing.T) {
	_, c := newMainRepo(t, tripPhotos)
	for name, tc := range map[string]struct {
		id   string
		area PlaceArea
		want int
	}{
		"no such place": {"nowhere", PlaceArea{Shape: square}, http.StatusNotFound},
		"no outline":    {"station", PlaceArea{}, http.StatusBadRequest},
		"bad ID":        {"Not An ID", PlaceArea{Shape: square}, http.StatusBadRequest},
	} {
		_, err := c.SavePlaceArea(t.Context(), placesGH, tc.id, tc.area)
		var perr *PublishError
		if !errors.As(err, &perr) || perr.Status != tc.want {
			t.Errorf("%s: error = %v, want %d", name, err, tc.want)
		}
	}
}
