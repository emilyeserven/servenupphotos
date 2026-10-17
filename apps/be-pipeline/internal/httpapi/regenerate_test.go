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
	every := make([]string, 0, len(versions.All))
	for _, v := range versions.All {
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
		{"no key", `{}`, nil, http.StatusBadRequest, "key is required", nil},
		{"unknown version", `{"key":"photos/k.jpg","versions":["huge"]}`, nil, http.StatusBadRequest, "no such version", nil},
		{"gone", `{"key":"photos/k.jpg"}`, &storage.UploadError{Message: "isn't in the bucket anymore", NotFound: true}, http.StatusNotFound, "anymore", every},
		{"not set up", `{"key":"photos/k.jpg"}`, &storage.UploadError{Message: "Fill in Bucket first.", NotConfigured: true}, http.StatusBadRequest, "Fill in Bucket", every},
		{"rejected", `{"key":"photos/k.jpg"}`, &storage.UploadError{Message: "no bucket", Cloudflare: &storage.CloudflareResponse{Status: 404}}, http.StatusBadGateway, `"cloudflare":{"status":404`, every},
		{"other failure", `{"key":"photos/k.jpg"}`, errors.New("disk on fire"), http.StatusInternalServerError, "could not make", every},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var gotNames []string
			regenerate := func(_ context.Context, _ settings.R2, key string, vs []versions.Version) (map[string]storage.Uploaded, error) {
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
