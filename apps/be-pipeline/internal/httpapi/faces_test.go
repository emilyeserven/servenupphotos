package httpapi

import (
	"bytes"
	"context"
	"errors"
	"image"
	"image/jpeg"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/versions"
)

func TestSavedFacesHandler(t *testing.T) {
	cfg := func() (settings.R2, error) { return settings.R2{Bucket: "photos"}, nil }
	tests := []struct {
		name   string
		query  string
		faces  versions.Faces
		err    error
		status int
		want   string
	}{
		{"saved", "?key=photos/k.jpg", versions.Faces{{X: 1, Y: 2, Width: 30, Height: 40, Blocks: 8}}, nil, http.StatusOK, `"faces":[{"x":1,"y":2,"width":30,"height":40,"blocks":8}]`},
		{"none", "?key=photos/k.jpg", nil, nil, http.StatusOK, `"faces":[]`},
		{"no key", "", nil, nil, http.StatusBadRequest, "key is required"},
		{"not a pipeline photo", "?key=k.jpg", nil, &storage.UploadError{Message: "Only photos", NotFound: true}, http.StatusNotFound, "Only photos"},
		{"other failure", "?key=photos/k.jpg", nil, errors.New("disk on fire"), http.StatusInternalServerError, "could not read"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			read := func(context.Context, settings.R2, string) (versions.Faces, error) { return tt.faces, tt.err }
			req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/photos/bucket/faces"+tt.query, nil)
			rec := httptest.NewRecorder()
			handleSavedFaces(cfg, read)(rec, req)
			if rec.Code != tt.status || !strings.Contains(rec.Body.String(), tt.want) {
				t.Errorf("status = %d, body %s; want %d with %q", rec.Code, rec.Body, tt.status, tt.want)
			}
		})
	}
}

func TestDetectFacesHandler(t *testing.T) {
	cfg := func() (settings.R2, error) { return settings.R2{Bucket: "photos"}, nil }
	var photo bytes.Buffer
	if err := jpeg.Encode(&photo, image.NewRGBA(image.Rect(0, 0, 40, 30)), nil); err != nil {
		t.Fatal(err)
	}
	found := versions.Faces{{X: 5, Y: 5, Width: 10, Height: 10, Blocks: 8}}
	tests := []struct {
		name   string
		body   string
		jpeg   string
		getErr error
		status int
		want   string
	}{
		{"found", `{"key":"photos/k.jpg"}`, photo.String(), nil, http.StatusOK, `"faces":[{"x":5,"y":5,"width":10,"height":10,"blocks":8}]`},
		{"no key", `{}`, "", nil, http.StatusBadRequest, "key is required"},
		{"not a JPEG", `{"key":"photos/k.jpg"}`, "nope", nil, http.StatusUnprocessableEntity, "Couldn't read"},
		{"gone", `{"key":"photos/k.jpg"}`, "", &storage.GetError{Message: "That photo isn't in the bucket.", NotFound: true}, http.StatusNotFound, "isn't in the bucket"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			get := func(context.Context, settings.R2, string) (io.ReadCloser, error) {
				if tt.getErr != nil {
					return nil, tt.getErr
				}
				return io.NopCloser(strings.NewReader(tt.jpeg)), nil
			}
			detect := func(img image.Image) (versions.Faces, error) {
				if img.Bounds().Dx() != 40 {
					t.Errorf("detect got a %v photo", img.Bounds())
				}
				return found, nil
			}
			req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/photos/bucket/faces/detect", strings.NewReader(tt.body))
			rec := httptest.NewRecorder()
			handleDetectFaces(cfg, get, detect)(rec, req)
			if rec.Code != tt.status || !strings.Contains(rec.Body.String(), tt.want) {
				t.Errorf("status = %d, body %s; want %d with %q", rec.Code, rec.Body, tt.status, tt.want)
			}
		})
	}
}
