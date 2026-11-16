package httpapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

func TestDeletePhotoNeedsPath(t *testing.T) {
	router := NewRouter(nil, settings.NewStore(filepath.Join(t.TempDir(), "settings.json")))
	req := httptest.NewRequestWithContext(t.Context(), http.MethodDelete, "/photos/saved", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "path is required") {
		t.Errorf("status = %d, body %s; want 400 asking for a path", rec.Code, rec.Body)
	}
}

func TestDeletedImagesWithOriginal(t *testing.T) {
	store := settings.NewStore(filepath.Join(t.TempDir(), "settings.json"))
	deleted := github.DeletedPhoto{
		RemovedFile: github.RemovedFile{Path: "data/a.json", PhotoName: "A.jpg", ImageKey: "photos/a.jpg"},
		OriginalKey: "photos/a-original.jpg",
	}
	find := func(_ context.Context, _ settings.R2, refs []storage.PhotoRef) (map[storage.PhotoRef]storage.Uploaded, string) {
		return map[storage.PhotoRef]storage.Uploaded{refs[0]: {Key: "photos/a.jpg"}}, ""
	}
	var keys []string
	del := func(_ context.Context, _ settings.R2, key string) string {
		keys = append(keys, key)
		return ""
	}
	image, original := deletedImages(t.Context(), store, find, del, deleted)
	if !image.Deleted || original == nil || !original.Deleted || original.Key != "photos/a-original.jpg" {
		t.Errorf("deletedImages() = %+v, %+v; want both deleted", image, original)
	}
	for _, key := range []string{"photos/a.jpg", "photos/a-small.webp", "photos/a-original.jpg", "photos/a-original-thumbnail.webp"} {
		if !slices.Contains(keys, key) {
			t.Errorf("deleted %q, want %s among them", keys, key)
		}
	}
}
