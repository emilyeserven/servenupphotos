package httpapi

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

func TestPhotosInFlightNotSetUp(t *testing.T) {
	router := NewRouter(nil, settings.NewStore(filepath.Join(t.TempDir(), "settings.json")))
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/photos/in-flight", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "Settings first") {
		t.Errorf("status = %d, body %s; want 400 asking for settings", rec.Code, rec.Body)
	}
}
