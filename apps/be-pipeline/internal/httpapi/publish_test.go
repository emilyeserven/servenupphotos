package httpapi

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

func TestPublishPhoto(t *testing.T) {
	router := NewRouter(nil, settings.NewStore(filepath.Join(t.TempDir(), "settings.json")))
	tests := []struct {
		name   string
		body   string
		status int
		want   string
	}{
		{"invalid body", `{"unknown":1}`, http.StatusBadRequest, "invalid photo data body"},
		{"not set up", `{"name":"DSC0001","file":"DSC0001.jpg","sanitized":{}}`, http.StatusBadRequest, "Settings first"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/photos/github", strings.NewReader(tt.body))
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)
			if rec.Code != tt.status || !strings.Contains(rec.Body.String(), tt.want) {
				t.Errorf("status = %d, body %s; want %d containing %q", rec.Code, rec.Body, tt.status, tt.want)
			}
		})
	}
}

func TestAllPhotosCheck(t *testing.T) {
	router := NewRouter(nil, settings.NewStore(filepath.Join(t.TempDir(), "settings.json")))
	tests := []struct {
		name   string
		body   string
		status int
		want   string
	}{
		{"invalid body", `not json`, http.StatusBadRequest, "invalid photo body"},
		{"no file", `{"gpsPosition":null}`, http.StatusBadRequest, "file is required"},
		{"not set up", `{"file":"DSC0001.jpg","gpsPosition":null,"createDate":null}`, http.StatusBadRequest, "Settings first"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/photos/all-photos/check", strings.NewReader(tt.body))
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)
			if rec.Code != tt.status || !strings.Contains(rec.Body.String(), tt.want) {
				t.Errorf("status = %d, body %s; want %d containing %q", rec.Code, rec.Body, tt.status, tt.want)
			}
		})
	}
}
