package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime/multipart"
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
		name     string
		content  []byte
		sameName string
		err      error
		want     int
		message  string
	}{
		{"uploaded", photo, "", nil, http.StatusOK, ""},
		{"keeping the same name", photo, "keep", nil, http.StatusOK, ""},
		{"not a jpeg", []byte("\x89PNG\r\n\x1a\n"), "", nil, http.StatusUnsupportedMediaType, "photo must be a JPEG"},
		{"not configured", photo, "", &storage.UploadError{Message: "Fill in Bucket first.", NotConfigured: true}, http.StatusBadRequest, "Fill in Bucket first."},
		{"same name", photo, "", &storage.UploadError{Message: "already has", SameName: []storage.BucketImage{{Key: "photos/a-img-0001.jpg"}}}, http.StatusConflict, `"sameName":[{"key":"photos/a-img-0001.jpg"`},
		{"unreadable", photo, "", &storage.UploadError{Message: "Couldn't read this JPEG", NotAPhoto: true}, http.StatusUnprocessableEntity, "Couldn't read this JPEG"},
		{"rejected", photo, "", &storage.UploadError{Message: "no bucket", Cloudflare: &storage.CloudflareResponse{Status: 404, Code: "NoSuchBucket"}}, http.StatusBadGateway, `"cloudflare":{"status":404,"code":"NoSuchBucket"`},
		{"other failure", photo, "", errors.New("disk on fire"), http.StatusInternalServerError, "could not upload photo"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var gotName string
			var gotBody []byte
			upload := func(_ context.Context, cfg settings.R2, name string, body io.ReadSeeker, opts storage.UploadOptions) (storage.UploadResult, error) {
				if cfg != stored {
					t.Errorf("cfg = %+v, want the stored settings", cfg)
				}
				if opts.KeepSameName != (tt.sameName == "keep") {
					t.Errorf("KeepSameName = %v with sameName %q", opts.KeepSameName, tt.sameName)
				}
				gotName = name
				gotBody, _ = io.ReadAll(body)
				return storage.UploadResult{
					Uploaded: storage.Uploaded{Key: "photos/k.jpg", URL: "https://cdn.example/photos/k.jpg"},
					Versions: map[string]storage.Uploaded{"small": {Key: "photos/k-small.webp", URL: "https://cdn.example/photos/k-small.webp"}},
				}, tt.err
			}

			body, contentType := uploadBody(t, tt.sameName, tt.content)
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
			var res storage.UploadResult
			if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
				t.Fatalf("decode: %v", err)
			}
			if res.URL != "https://cdn.example/photos/k.jpg" || res.Key != "photos/k.jpg" || res.Versions["small"].Key != "photos/k-small.webp" {
				t.Errorf("res = %+v", res)
			}
			if gotName != "IMG_0001.jpg" || string(gotBody) != string(photo) {
				t.Errorf("uploaded %q with %d bytes, want IMG_0001.jpg with %d", gotName, len(gotBody), len(photo))
			}
		})
	}
}

// uploadBody is a multipart form with an optional sameName field, then the photo.
func uploadBody(t *testing.T, sameName string, photo []byte) (io.Reader, string) {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	if sameName != "" {
		if err := mw.WriteField("sameName", sameName); err != nil {
			t.Fatal(err)
		}
	}
	part, err := mw.CreateFormFile("photo", "IMG_0001.jpg")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write(photo); err != nil {
		t.Fatal(err)
	}
	if err := mw.Close(); err != nil {
		t.Fatal(err)
	}
	return &buf, mw.FormDataContentType()
}
