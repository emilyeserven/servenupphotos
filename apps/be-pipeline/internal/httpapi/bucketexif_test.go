package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

func TestBucketExif(t *testing.T) {
	cfg := func() (settings.R2, error) { return settings.R2{Bucket: "photos"}, nil }
	serve := func(content []byte, err error) getPhotoFunc {
		return func(context.Context, settings.R2, string) (io.ReadCloser, error) {
			if err != nil {
				return nil, err
			}
			return io.NopCloser(bytes.NewReader(content)), nil
		}
	}
	photo := redJPEG(t)
	tests := []struct {
		name   string
		body   string
		get    getPhotoFunc
		status int
		want   string
	}{
		{"original", `{"key":"photos/233d38afbc8e-img-0001.jpg"}`, serve(photo, nil), http.StatusOK, `"file":"img-0001.jpg"`},
		{"no key", `{}`, serve(photo, nil), http.StatusBadRequest, "key"},
		{"bad key", `{"key":"notes.txt"}`, serve(nil, &storage.GetError{Message: "Only uploaded JPEG photos", BadKey: true}), http.StatusBadRequest, "Only uploaded"},
		{"gone", `{"key":"photos/a.jpg"}`, serve(nil, &storage.GetError{Message: "isn't in the bucket", NotFound: true}), http.StatusNotFound, "isn't in the bucket"},
		{"refused", `{"key":"photos/a.jpg"}`, serve(nil, &storage.GetError{Message: "isn't allowed"}), http.StatusBadGateway, "isn't allowed"},
		{"not a jpeg", `{"key":"photos/a.jpg"}`, serve([]byte("\x89PNG\r\n\x1a\n"), nil), http.StatusUnsupportedMediaType, "isn't a JPEG"},
		{"undecodable", `{"key":"photos/a.jpg"}`, serve(truncatedJPEG, nil), http.StatusUnprocessableEntity, "could not decode"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			extractor := &fakeExtractor{}
			req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/photos/bucket/exif", strings.NewReader(tt.body))
			rec := httptest.NewRecorder()
			handleBucketExif(extractor, cfg, tt.get, nil)(rec, req)
			if rec.Code != tt.status || !strings.Contains(rec.Body.String(), tt.want) {
				t.Fatalf("status = %d, body %s; want %d with %q", rec.Code, rec.Body, tt.status, tt.want)
			}
			if tt.status != http.StatusOK {
				return
			}
			var res exifResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
				t.Fatal(err)
			}
			if !bytes.Equal(extractor.got, photo) || res.Sanitized == nil || res.Colors.Samples == 0 {
				t.Errorf("res = %+v; want the R2 photo's EXIF and colors", res)
			}
		})
	}
}
