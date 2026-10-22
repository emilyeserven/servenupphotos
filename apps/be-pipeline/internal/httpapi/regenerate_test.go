package httpapi

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/versions"
)

func TestRegenerateVersionsHandler(t *testing.T) {
	cfg := func() (settings.R2, error) { return settings.R2{Bucket: "photos"}, nil }
	every := make([]string, 0, len(versions.Published()))
	for _, v := range versions.Published() {
		every = append(every, v.Name)
	}
	tests := []struct {
		name      string
		body      string
		err       error
		status    int
		want      string
		wantNames []string
	}{
		{"some", `{"key":"photos/k.jpg","versions":["small"]}`, nil, http.StatusOK, `"small":{"key":"photos/k-small.webp"`, []string{"small"}},
		{"every version", `{"key":"photos/k.jpg"}`, nil, http.StatusOK, `"key":"photos/k.jpg"`, every},
		{"thumbnail", `{"key":"photos/k.jpg","versions":["thumbnail"]}`, nil, http.StatusOK, `"key":"photos/k.jpg"`, []string{"thumbnail"}},
		{"no key", `{}`, nil, http.StatusBadRequest, "key is required", nil},
		{"bad crop", `{"key":"photos/k.jpg","versions":["thumbnail"],"crop":{"x":0,"y":0,"size":0}}`, nil, http.StatusBadRequest, "crop needs a size", nil},
		{"unknown version", `{"key":"photos/k.jpg","versions":["huge"]}`, nil, http.StatusBadRequest, "no such version", nil},
		{"gone", `{"key":"photos/k.jpg"}`, &storage.UploadError{Message: "isn't in the bucket anymore", NotFound: true}, http.StatusNotFound, "anymore", every},
		{"not set up", `{"key":"photos/k.jpg"}`, &storage.UploadError{Message: "Fill in Bucket first.", NotConfigured: true}, http.StatusBadRequest, "Fill in Bucket", every},
		{"rejected", `{"key":"photos/k.jpg"}`, &storage.UploadError{Message: "no bucket", Cloudflare: &storage.CloudflareResponse{Status: 404}}, http.StatusBadGateway, `"cloudflare":{"status":404`, every},
		{"other failure", `{"key":"photos/k.jpg"}`, errors.New("disk on fire"), http.StatusInternalServerError, "could not make", every},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var gotNames []string
			regenerate := func(_ context.Context, _ settings.R2, key string, vs []versions.Version, _ *versions.Crop) (map[string]storage.Uploaded, error) {
				out := map[string]storage.Uploaded{}
				for _, v := range vs {
					gotNames = append(gotNames, v.Name)
					out[v.Name] = storage.Uploaded{Key: storage.VersionKey(key, v.Name)}
				}
				return out, tt.err
			}
			req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/photos/bucket/versions", strings.NewReader(tt.body))
			rec := httptest.NewRecorder()
			handleRegenerateVersions(cfg, regenerate)(rec, req)
			if rec.Code != tt.status || !strings.Contains(rec.Body.String(), tt.want) {
				t.Errorf("status = %d, body %s; want %d with %q", rec.Code, rec.Body, tt.status, tt.want)
			}
			if !slices.Equal(gotNames, tt.wantNames) {
				t.Errorf("versions = %q, want %q", gotNames, tt.wantNames)
			}
		})
	}
}

func TestRegenerateVersionsHandlerPassesTheCrop(t *testing.T) {
	cfg := func() (settings.R2, error) { return settings.R2{Bucket: "photos"}, nil }
	var got *versions.Crop
	regenerate := func(_ context.Context, _ settings.R2, _ string, _ []versions.Version, crop *versions.Crop) (map[string]storage.Uploaded, error) {
		got = crop
		return map[string]storage.Uploaded{}, nil
	}
	body := `{"key":"photos/k.jpg","versions":["thumbnail"],"crop":{"x":12,"y":0,"size":800}}`
	req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/photos/bucket/versions", strings.NewReader(body))
	rec := httptest.NewRecorder()
	handleRegenerateVersions(cfg, regenerate)(rec, req)
	if rec.Code != http.StatusOK || got == nil || *got != (versions.Crop{X: 12, Y: 0, Size: 800}) {
		t.Errorf("status = %d, crop = %v; want 200 with the body's crop", rec.Code, got)
	}
}

func TestThumbnailCropHandler(t *testing.T) {
	cfg := func() (settings.R2, error) { return settings.R2{Bucket: "photos"}, nil }
	tests := []struct {
		name   string
		query  string
		crop   *versions.Crop
		err    error
		status int
		want   string
	}{
		{"saved", "?key=photos/k.jpg", &versions.Crop{X: 1, Y: 2, Size: 300}, nil, http.StatusOK, `"crop":{"x":1,"y":2,"size":300}`},
		{"middle", "?key=photos/k.jpg", nil, nil, http.StatusOK, `"crop":null`},
		{"no key", "", nil, nil, http.StatusBadRequest, "key is required"},
		{"not a pipeline photo", "?key=k.jpg", nil, &storage.UploadError{Message: "Only photos", NotFound: true}, http.StatusNotFound, "Only photos"},
		{"other failure", "?key=photos/k.jpg", nil, errors.New("disk on fire"), http.StatusInternalServerError, "could not read"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			readCrop := func(context.Context, settings.R2, string) (*versions.Crop, error) { return tt.crop, tt.err }
			req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/photos/bucket/thumbnail-crop"+tt.query, nil)
			rec := httptest.NewRecorder()
			handleThumbnailCrop(cfg, readCrop)(rec, req)
			if rec.Code != tt.status || !strings.Contains(rec.Body.String(), tt.want) {
				t.Errorf("status = %d, body %s; want %d with %q", rec.Code, rec.Body, tt.status, tt.want)
			}
		})
	}
}
