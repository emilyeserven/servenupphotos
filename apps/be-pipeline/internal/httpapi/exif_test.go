package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

type fakeExtractor struct{ got []byte }

func (f *fakeExtractor) Extract(path string) (map[string]any, error) {
	b, err := os.ReadFile(path) //nolint:gosec // test temp file
	f.got = b
	return map[string]any{"Make": "Servenup", "Model": "Test Camera"}, err
}

func TestExif(t *testing.T) {
	photo := redJPEG(t)
	tests := []struct {
		name      string
		extractor *fakeExtractor
		field     string
		content   []byte
		want      int
	}{
		{"jpeg", &fakeExtractor{}, "photo", photo, http.StatusOK},
		{"no exiftool", nil, "photo", photo, http.StatusOK},
		{"not a jpeg", &fakeExtractor{}, "photo", []byte("\x89PNG\r\n\x1a\n"), http.StatusUnsupportedMediaType},
		{"undecodable jpeg", &fakeExtractor{}, "photo", truncatedJPEG, http.StatusUnprocessableEntity},
		{"missing field", &fakeExtractor{}, "other", photo, http.StatusBadRequest},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var router http.Handler
			if tt.extractor == nil {
				router = NewRouter(nil, nil)
			} else {
				router = NewRouter(tt.extractor, nil)
			}

			body, contentType := multipartBody(t, tt.field, "IMG_0001.jpg", tt.content)
			req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/exif", body)
			req.Header.Set("Content-Type", contentType)
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)

			if rec.Code != tt.want {
				t.Fatalf("status = %d, want %d (body %s)", rec.Code, tt.want, rec.Body)
			}
			if tt.want != http.StatusOK {
				return
			}
			var res exifResponse
			if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
				t.Fatalf("decode: %v", err)
			}
			if res.File != "IMG_0001.jpg" {
				t.Errorf("file = %q", res.File)
			}
			if b := res.Colors.Buckets; len(b) == 0 || b[0].Name != "red" || b[0].Share < 0.99 {
				t.Errorf("buckets = %+v, want the photo in red", b)
			}
			if tt.extractor == nil {
				if res.Exif != nil {
					t.Errorf("exif = %v, want null without exiftool", res.Exif)
				}
				if res.Sanitized != nil {
					t.Errorf("sanitized = %+v, want null without exiftool", res.Sanitized)
				}
				return
			}
			if res.Exif["Make"] != "Servenup" {
				t.Errorf("exif = %v", res.Exif)
			}
			if res.Sanitized == nil || res.Sanitized.Camera == nil || *res.Sanitized.Camera != "Test Camera" {
				t.Errorf("sanitized = %+v, want camera Test Camera", res.Sanitized)
			}
			if !bytes.Equal(tt.extractor.got, photo) {
				t.Errorf("extractor got %d bytes, want the whole upload (%d)", len(tt.extractor.got), len(photo))
			}
		})
	}
}
