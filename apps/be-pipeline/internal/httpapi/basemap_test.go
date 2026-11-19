package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestBasemap(t *testing.T) {
	for set, want := range map[string]string{"\tabc\n": "abc", "": ""} {
		t.Setenv("CARTO_KEY", set)
		rec := httptest.NewRecorder()
		handleBasemap()(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/basemap", nil))
		var got basemapAnswer
		if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil || rec.Code != http.StatusOK {
			t.Fatalf("%q: %d %s", set, rec.Code, rec.Body)
		}
		if got.CartoKey != want {
			t.Errorf("%q: cartoKey %q, want %q", set, got.CartoKey, want)
		}
	}
}
