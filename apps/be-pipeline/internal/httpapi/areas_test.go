package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/areas"
)

// fakeAreas answers every look-up with found, or err.
type fakeAreas struct {
	found []areas.Area
	err   error
	asked string
}

func (f *fakeAreas) Find(_ context.Context, q string) ([]areas.Area, error) {
	f.asked = q
	return f.found, f.err
}

func TestHandleFindAreas(t *testing.T) {
	f := &fakeAreas{found: []areas.Area{{Name: "Osaka Castle Park", OSM: "R1", Shape: areas.Shape{{{{1, 2}, {2, 2}, {2, 3}, {1, 2}}}}}}}
	rec := httptest.NewRecorder()
	handleFindAreas(f)(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/areas?q=Osaka+Castle+Park", nil))
	var got []areas.Area
	if rec.Code != http.StatusOK || json.Unmarshal(rec.Body.Bytes(), &got) != nil || len(got) != 1 || f.asked != "Osaka Castle Park" {
		t.Errorf("%d %s", rec.Code, rec.Body)
	}
	for q, want := range map[string]int{"": http.StatusBadRequest} {
		rec := httptest.NewRecorder()
		handleFindAreas(f)(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/areas?q="+q, nil))
		if rec.Code != want {
			t.Errorf("q=%q: %d, want %d", q, rec.Code, want)
		}
	}
	f.err = areas.ErrNoRelation
	rec = httptest.NewRecorder()
	handleFindAreas(f)(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/areas?q=Q2", nil))
	if rec.Code != http.StatusNotFound {
		t.Errorf("no relation: %d", rec.Code)
	}
}
