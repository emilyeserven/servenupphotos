package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

func TestRoutes(t *testing.T) {
	tests := []struct {
		path, key, want string
	}{
		{"/health", "status", "ok"},
		{"/hello", "message", "Hello from be-pipeline (Go)"},
	}

	router := NewRouter(nil, settings.NewStore(filepath.Join(t.TempDir(), "settings.json")))
	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, tt.path, nil))

			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
			}
			var body map[string]string
			if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
				t.Fatalf("decode: %v", err)
			}
			if body[tt.key] != tt.want {
				t.Errorf("%s = %q, want %q", tt.key, body[tt.key], tt.want)
			}
		})
	}
}
