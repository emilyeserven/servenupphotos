package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

func TestBucketImages(t *testing.T) {
	cfg := func() (settings.R2, error) { return settings.R2{Bucket: " photos "}, nil }
	tests := []struct {
		name   string
		list   listImagesFunc
		status int
		want   string
	}{
		{"ok", func(context.Context, settings.R2) ([]storage.BucketImage, error) {
			return []storage.BucketImage{{Key: "photos/a.jpg", URL: "https://pub/photos/a.jpg"}}, nil
		}, http.StatusOK, `"key":"photos/a.jpg"`},
		{"not set up", func(context.Context, settings.R2) ([]storage.BucketImage, error) {
			return nil, &storage.ListError{Message: "Fill in Bucket first.", NotConfigured: true}
		}, http.StatusBadRequest, "Fill in Bucket first."},
		{"refused", func(context.Context, settings.R2) ([]storage.BucketImage, error) {
			return nil, &storage.ListError{Message: "This token isn't allowed to read that bucket."}
		}, http.StatusBadGateway, "isn't allowed"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/photos/bucket", nil)
			rec := httptest.NewRecorder()
			handleBucketImages(cfg, tt.list)(rec, req)
			if rec.Code != tt.status || !strings.Contains(rec.Body.String(), tt.want) {
				t.Errorf("status = %d, body %s; want %d with %q", rec.Code, rec.Body, tt.status, tt.want)
			}
			if tt.status == http.StatusOK {
				var body bucketResponse
				if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil || body.Bucket != "photos" {
					t.Errorf("body = %+v, %v; want bucket photos", body, err)
				}
			}
		})
	}
}
