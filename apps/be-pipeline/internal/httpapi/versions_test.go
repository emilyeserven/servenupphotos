package httpapi

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gen2brain/webp"
)

func TestVersionPreview(t *testing.T) {
	tests := []struct {
		name    string
		version string
		content []byte
		want    int
		message string
	}{
		{"small", "small", redJPEG(t), http.StatusOK, ""},
		{"unknown version", "huge", redJPEG(t), http.StatusNotFound, "no such version"},
		{"not a jpeg", "small", []byte("\x89PNG\r\n\x1a\n"), http.StatusUnsupportedMediaType, "photo must be a JPEG"},
		{"unreadable jpeg", "small", truncatedJPEG, http.StatusUnprocessableEntity, "Couldn't read this JPEG"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, contentType := multipartBody(t, "photo", "IMG_0001.jpg", tt.content)
			req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/photos/versions/"+tt.version, body)
			req.Header.Set("Content-Type", contentType)
			rec := httptest.NewRecorder()
			newRouter(nil, nil, nil).ServeHTTP(rec, req)

			if rec.Code != tt.want {
				t.Fatalf("status = %d, want %d (body %s)", rec.Code, tt.want, rec.Body)
			}
			if tt.want != http.StatusOK {
				if !strings.Contains(rec.Body.String(), tt.message) {
					t.Errorf("body = %s, want %q", rec.Body, tt.message)
				}
				return
			}
			if ct := rec.Header().Get("Content-Type"); ct != "image/webp" {
				t.Errorf("content type = %q", ct)
			}
			// redJPEG is 16×16, smaller than every version, so it keeps its size.
			cfg, err := webp.DecodeConfig(bytes.NewReader(rec.Body.Bytes()))
			if err != nil || cfg.Width != 16 || cfg.Height != 16 {
				t.Errorf("got %+v, %v; want a 16×16 WEBP", cfg, err)
			}
		})
	}
}
