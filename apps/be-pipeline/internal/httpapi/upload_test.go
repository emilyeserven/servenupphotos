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
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/versions"
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

func TestParseCrop(t *testing.T) {
	tests := []struct {
		name   string
		fields map[string]string
		want   *versions.Crop
		ok     bool
	}{
		{"none", map[string]string{"sameName": "keep"}, nil, true},
		{"all three", map[string]string{"cropX": "10", "cropY": "-4", "cropSize": "300"}, &versions.Crop{X: 10, Y: -4, Size: 300}, true},
		{"missing one", map[string]string{"cropX": "10", "cropSize": "300"}, nil, false},
		{"not a number", map[string]string{"cropX": "10.5", "cropY": "0", "cropSize": "300"}, nil, false},
		{"no size", map[string]string{"cropX": "0", "cropY": "0", "cropSize": "0"}, nil, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := parseCrop(tt.fields)
			if ok != tt.ok || (got == nil) != (tt.want == nil) || (got != nil && *got != *tt.want) {
				t.Errorf("parseCrop = %+v, %v; want %+v, %v", got, ok, tt.want, tt.ok)
			}
		})
	}
}

func TestUploadCrop(t *testing.T) {
	store := settings.NewStore(filepath.Join(t.TempDir(), "settings.json"))
	send := func(t *testing.T, fields map[string]string, upload uploadFunc) *httptest.ResponseRecorder {
		t.Helper()
		var buf bytes.Buffer
		mw := multipart.NewWriter(&buf)
		for _, name := range []string{"cropX", "cropY", "cropSize"} {
			if err := mw.WriteField(name, fields[name]); err != nil {
				t.Fatal(err)
			}
		}
		part, err := mw.CreateFormFile("photo", "IMG_0001.jpg")
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write(redJPEG(t)); err != nil {
			t.Fatal(err)
		}
		if err := mw.Close(); err != nil {
			t.Fatal(err)
		}
		req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/upload", &buf)
		req.Header.Set("Content-Type", mw.FormDataContentType())
		rec := httptest.NewRecorder()
		handleUpload(store.R2, upload).ServeHTTP(rec, req)
		return rec
	}

	t.Run("passed on", func(t *testing.T) {
		var got *versions.Crop
		upload := func(_ context.Context, _ settings.R2, _ string, _ io.ReadSeeker, opts storage.UploadOptions) (storage.UploadResult, error) {
			got = opts.Crop
			return storage.UploadResult{}, nil
		}
		rec := send(t, map[string]string{"cropX": "12", "cropY": "34", "cropSize": "560"}, upload)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d (body %s)", rec.Code, rec.Body)
		}
		if got == nil || *got != (versions.Crop{X: 12, Y: 34, Size: 560}) {
			t.Errorf("crop = %+v", got)
		}
	})

	t.Run("invalid", func(t *testing.T) {
		upload := func(context.Context, settings.R2, string, io.ReadSeeker, storage.UploadOptions) (storage.UploadResult, error) {
			t.Error("uploaded with an invalid crop")
			return storage.UploadResult{}, nil
		}
		rec := send(t, map[string]string{"cropX": "a", "cropY": "0", "cropSize": "10"}, upload)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want 400", rec.Code)
		}
	})
}
