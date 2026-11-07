package httpapi

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

func TestUploadGearImage(t *testing.T) {
	store := settings.NewStore(filepath.Join(t.TempDir(), "settings.json"))
	tests := []struct {
		name    string
		field   string
		content []byte
		err     error
		want    int
		message string
	}{
		{"uploaded", "image", redJPEG(t), nil, http.StatusOK, `"url":"https://cdn.example/gear/k.webp"`},
		{"a PNG", "image", []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"), nil, http.StatusOK, `"key":"gear/k.webp"`},
		{"not a picture", "image", []byte("hello"), nil, http.StatusUnsupportedMediaType, "JPEG, PNG or WEBP"},
		{"no image field", "photo", redJPEG(t), nil, http.StatusBadRequest, `missing \"image\" field`},
		{"unreadable", "image", redJPEG(t), &storage.UploadError{Message: "Couldn't read this picture.", NotAPhoto: true}, http.StatusUnprocessableEntity, "Couldn't read"},
		{"other failure", "image", redJPEG(t), errors.New("disk on fire"), http.StatusInternalServerError, "could not upload the picture"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var gotName string
			upload := func(_ context.Context, _ settings.R2, name string, body io.Reader) (storage.GearOriginal, error) {
				gotName = name
				_, _ = io.ReadAll(body)
				return storage.GearOriginal{Uploaded: storage.Uploaded{Key: "gear/k.webp", URL: "https://cdn.example/gear/k.webp"}, Width: 4, Height: 3}, tt.err
			}
			body, contentType := multipartBody(t, tt.field, "x-t5.png", tt.content)
			req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/gear/image", body)
			req.Header.Set("Content-Type", contentType)
			rec := httptest.NewRecorder()
			handleUploadGearImage(store.R2, upload).ServeHTTP(rec, req)
			if rec.Code != tt.want || !strings.Contains(rec.Body.String(), tt.message) {
				t.Fatalf("status = %d, body %s; want %d with %q", rec.Code, rec.Body, tt.want, tt.message)
			}
			if tt.want == http.StatusOK && gotName != "x-t5.png" {
				t.Errorf("name = %q, want x-t5.png", gotName)
			}
		})
	}
}

func TestCropGearImage(t *testing.T) {
	store := settings.NewStore(filepath.Join(t.TempDir(), "settings.json"))
	tests := []struct {
		name    string
		body    string
		err     error
		want    int
		message string
	}{
		{"cropped", `{"original":"https://cdn.example/gear/originals/a.png","crop":{"x":0.1,"y":0,"width":0.8,"height":0.6}}`, nil, http.StatusOK, `"url":"https://cdn.example/gear/c.webp"`},
		{"not JSON", `crop`, nil, http.StatusBadRequest, "invalid crop body"},
		{"refused", `{"original":"x","crop":{}}`, &storage.UploadError{Message: "Pick a gear picture."}, http.StatusBadGateway, "Pick a gear picture."},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var got storage.GearCrop
			crop := func(_ context.Context, _ settings.R2, _ string, c storage.GearCrop) (storage.Uploaded, error) {
				got = c
				return storage.Uploaded{Key: "gear/c.webp", URL: "https://cdn.example/gear/c.webp"}, tt.err
			}
			req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/gear/crop", strings.NewReader(tt.body))
			rec := httptest.NewRecorder()
			handleCropGearImage(store.R2, crop).ServeHTTP(rec, req)
			if rec.Code != tt.want || !strings.Contains(rec.Body.String(), tt.message) {
				t.Fatalf("status = %d, body %s; want %d with %q", rec.Code, rec.Body, tt.want, tt.message)
			}
			if tt.name == "cropped" && got.X != 0.1 {
				t.Errorf("crop = %+v, want the body's", got)
			}
		})
	}
}
