package httpapi

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
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

type fakeExtractor struct{ got []byte }

func (f *fakeExtractor) Extract(r io.Reader) (map[string]any, error) {
	b, err := io.ReadAll(r)
	f.got = b
	return map[string]any{"Make": "Servenup"}, err
}

// jpegBytes starts with the JPEG SOI/APP0 markers, enough for content sniffing.
var jpegBytes = []byte("\xff\xd8\xff\xe0\x00\x10JFIF\x00rest-of-image")

func multipartBody(t *testing.T, field, filename string, content []byte) (*bytes.Buffer, string) {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, err := mw.CreateFormFile(field, filename)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = fw.Write(content)
	_ = mw.Close()
	return &buf, mw.FormDataContentType()
}

func TestExif(t *testing.T) {
	tests := []struct {
		name      string
		extractor *fakeExtractor
		field     string
		content   []byte
		want      int
	}{
		{"jpeg", &fakeExtractor{}, "photo", jpegBytes, http.StatusOK},
		{"not a jpeg", &fakeExtractor{}, "photo", []byte("\x89PNG\r\n\x1a\n"), http.StatusUnsupportedMediaType},
		{"missing field", &fakeExtractor{}, "other", jpegBytes, http.StatusBadRequest},
		{"no exiftool", nil, "photo", jpegBytes, http.StatusServiceUnavailable},
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
			if res.File != "IMG_0001.jpg" || res.Metadata["Make"] != "Servenup" {
				t.Errorf("response = %+v", res)
			}
			if !bytes.Equal(tt.extractor.got, jpegBytes) {
				t.Errorf("extractor got %q, want the whole upload", tt.extractor.got)
			}
		})
	}
}
