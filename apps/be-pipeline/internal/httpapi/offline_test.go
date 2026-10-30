package httpapi

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/offline"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

func TestThumbnailServedFromOfflineCopy(t *testing.T) {
	store := settings.NewStore(filepath.Join(t.TempDir(), "settings.json"))
	online := true
	kept := offline.New(t.TempDir(), func(context.Context, settings.R2, string) (io.ReadCloser, error) {
		if !online {
			return nil, &storage.GetError{Message: "Couldn't reach R2."}
		}
		return io.NopCloser(strings.NewReader("webp")), nil
	})
	handler := handleThumbnail(store, kept)
	get := func(raw string) *httptest.ResponseRecorder {
		req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/thumbnails?url="+url.QueryEscape(raw), nil)
		rec := httptest.NewRecorder()
		handler(rec, req)
		return rec
	}

	square := "https://cdn.example.net/photos/233d38afbc8e-img-0001-thumbnail.webp"
	if rec := get(square); rec.Code != http.StatusOK || rec.Body.String() != "webp" || rec.Header().Get("Content-Type") != "image/webp" {
		t.Fatalf("online: %d %q %q", rec.Code, rec.Body, rec.Header().Get("Content-Type"))
	}
	online = false
	if rec := get(square); rec.Code != http.StatusOK || rec.Body.String() != "webp" {
		t.Errorf("offline, kept: %d %q; want the kept thumbnail", rec.Code, rec.Body)
	}
	if rec := get(strings.Replace(square, "-thumbnail.", "-thumbnailpreview.", 1)); rec.Code != http.StatusBadGateway {
		t.Errorf("offline, not kept: %d %s; want 502", rec.Code, rec.Body)
	}
	if rec := get("https://cdn.example.net/photos/233d38afbc8e-img-0001.jpg"); rec.Code != http.StatusBadRequest {
		t.Errorf("an original: %d; want 400", rec.Code)
	}
}

func TestFindImagesOffline(t *testing.T) {
	store := settings.NewStore(filepath.Join(t.TempDir(), "settings.json"))
	files := []github.InFlightFile{{Path: "data/a.json", PhotoName: "A.jpg"}}
	a := storage.PhotoRef{Name: "A.jpg"}
	kept := func(context.Context, settings.R2, []storage.PhotoRef) (map[storage.PhotoRef]storage.Uploaded, string) {
		return map[storage.PhotoRef]storage.Uploaded{a: {Key: "photos/a.jpg"}}, "Couldn't reach R2. " + offline.Note
	}
	images, err := findImages(t.Context(), store, kept, files)
	if err != nil || images.Checked || !images.Offline || images.ByPath["data/a.json"].Key != "photos/a.jpg" {
		t.Errorf("images = %+v, %v; want the kept image, marked offline", images, err)
	}
}
