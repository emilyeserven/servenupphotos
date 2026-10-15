package httpapi

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
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

func (f *fakeExtractor) Extract(path string) (map[string]any, error) {
	b, err := os.ReadFile(path) //nolint:gosec // test temp file
	f.got = b
	return map[string]any{"Make": "Servenup"}, err
}

// redJPEG returns a small solid red JPEG.
func redJPEG(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 16, 16))
	draw.Draw(img, img.Bounds(), &image.Uniform{C: color.RGBA{255, 0, 0, 255}}, image.Point{}, draw.Src)
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 100}); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

// truncatedJPEG starts with the JPEG SOI/APP0 markers, enough for content
// sniffing but not for decoding.
var truncatedJPEG = []byte("\xff\xd8\xff\xe0\x00\x10JFIF\x00rest-of-image")

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
				return
			}
			if res.Exif["Make"] != "Servenup" {
				t.Errorf("exif = %v", res.Exif)
			}
			if !bytes.Equal(tt.extractor.got, photo) {
				t.Errorf("extractor got %d bytes, want the whole upload (%d)", len(tt.extractor.got), len(photo))
			}
		})
	}
}
