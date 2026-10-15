package httpapi

import (
	"context"
	"encoding/json"
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

func TestUpload(t *testing.T) {
	store := settings.NewStore(filepath.Join(t.TempDir(), "settings.json"))
	if _, err := store.UpdateR2(settings.R2Update{Bucket: "photos"}); err != nil {
		t.Fatal(err)
	}
	stored := settings.R2{Bucket: "photos"}
	photo := redJPEG(t)

	tests := []struct {
		name    string
		content []byte
		err     error
		want    int
		message string
	}{
		{"uploaded", photo, nil, http.StatusOK, ""},
		{"not a jpeg", []byte("\x89PNG\r\n\x1a\n"), nil, http.StatusUnsupportedMediaType, "photo must be a JPEG"},
		{"not configured", photo, &storage.UploadError{Message: "Fill in Bucket first.", NotConfigured: true}, http.StatusConflict, "Fill in Bucket first."},
		{"rejected", photo, &storage.UploadError{Message: "no bucket"}, http.StatusBadGateway, "no bucket"},
		{"other failure", photo, errors.New("disk on fire"), http.StatusInternalServerError, "could not upload photo"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var gotName string
			var gotBody []byte
			upload := func(_ context.Context, cfg settings.R2, name string, body io.ReadSeeker) (storage.Uploaded, error) {
				if cfg != stored {
					t.Errorf("cfg = %+v, want the stored settings", cfg)
				}
				gotName = name
				gotBody, _ = io.ReadAll(body)
				return storage.Uploaded{Key: "photos/k.jpg", URL: "https://cdn.example/photos/k.jpg"}, tt.err
			}

			body, contentType := multipartBody(t, "photo", "IMG_0001.jpg", tt.content)
			req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/upload", body)
			req.Header.Set("Content-Type", contentType)
			rec := httptest.NewRecorder()
			handleUpload(store.R2, upload).ServeHTTP(rec, req)

			if rec.Code != tt.want {
				t.Fatalf("status = %d, want %d (body %s)", rec.Code, tt.want, rec.Body)
			}
			if tt.want != http.StatusOK {
				if !strings.Contains(rec.Body.String(), tt.message) {
					t.Errorf("body = %s, want %q", rec.Body, tt.message)
				}
				return
			}
			var res storage.Uploaded
			if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
				t.Fatalf("decode: %v", err)
			}
			if res.URL != "https://cdn.example/photos/k.jpg" || res.Key != "photos/k.jpg" {
				t.Errorf("res = %+v", res)
			}
			if gotName != "IMG_0001.jpg" || string(gotBody) != string(photo) {
				t.Errorf("uploaded %q with %d bytes, want IMG_0001.jpg with %d", gotName, len(gotBody), len(photo))
			}
		})
	}
}
