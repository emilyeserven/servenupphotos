package httpapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

func TestPhotosInFlightNotSetUp(t *testing.T) {
	router := NewRouter(nil, settings.NewStore(filepath.Join(t.TempDir(), "settings.json")))
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/photos/in-flight", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "Settings first") {
		t.Errorf("status = %d, body %s; want 400 asking for settings", rec.Code, rec.Body)
	}
}

func TestFindImages(t *testing.T) {
	store := settings.NewStore(filepath.Join(t.TempDir(), "settings.json"))
	files := []github.InFlightFile{
		{Path: "data/a.json", PhotoName: "A.jpg"},
		{Path: "data/b.json", PhotoName: "B.jpg", ImageURL: "https://pub/photos/b.jpg"},
	}
	a := storage.PhotoRef{Name: "A.jpg"}
	found := func(_ context.Context, _ settings.R2, refs []storage.PhotoRef) (map[storage.PhotoRef]storage.Uploaded, string) {
		if len(refs) != 2 || refs[0] != a || refs[1] != (storage.PhotoRef{Name: "B.jpg", URL: "https://pub/photos/b.jpg"}) {
			t.Errorf("refs = %v, want A.jpg, then B.jpg with its URL", refs)
		}
		return map[storage.PhotoRef]storage.Uploaded{a: {Key: "photos/a.jpg", URL: "https://pub/photos/a.jpg"}}, ""
	}
	images, err := findImages(t.Context(), store, found, files)
	if err != nil {
		t.Fatal(err)
	}
	if !images.Checked || len(images.ByPath) != 1 || images.ByPath["data/a.json"].Key != "photos/a.jpg" {
		t.Errorf("images = %+v, want a.json's image only", images)
	}

	broken := func(context.Context, settings.R2, []storage.PhotoRef) (map[storage.PhotoRef]storage.Uploaded, string) {
		return nil, "Fill in Bucket first."
	}
	images, err = findImages(t.Context(), store, broken, files)
	if err != nil || images.Checked || images.Message != "Fill in Bucket first." {
		t.Errorf("images = %+v, %v; want unchecked with the problem", images, err)
	}
}

func TestRemoveImage(t *testing.T) {
	store := settings.NewStore(filepath.Join(t.TempDir(), "settings.json"))
	removed := github.RemovedFile{Path: "data/a.json", PhotoName: "A.jpg", ImageKey: "photos/a.jpg"}
	ref := storage.PhotoRef{Name: "A.jpg", Key: "photos/a.jpg"}
	finds := func(found map[storage.PhotoRef]storage.Uploaded, problem string) findPhotosFunc {
		return func(context.Context, settings.R2, []storage.PhotoRef) (map[storage.PhotoRef]storage.Uploaded, string) {
			return found, problem
		}
	}
	var deletedKey string
	deletes := func(problem string) deletePhotoFunc {
		return func(_ context.Context, _ settings.R2, key string) string {
			deletedKey = key
			return problem
		}
	}
	tests := []struct {
		name    string
		find    findPhotosFunc
		delete  deletePhotoFunc
		want    removedImage
		deleted string
	}{
		{"deleted", finds(map[storage.PhotoRef]storage.Uploaded{ref: {Key: "photos/a.jpg"}}, ""), deletes(""),
			removedImage{Key: "photos/a.jpg", Deleted: true}, "photos/a.jpg"},
		{"delete fails", finds(map[storage.PhotoRef]storage.Uploaded{ref: {Key: "photos/a.jpg"}}, ""), deletes("not allowed"),
			removedImage{Key: "photos/a.jpg", Message: "not allowed"}, "photos/a.jpg"},
		{"no image", finds(map[storage.PhotoRef]storage.Uploaded{}, ""), deletes(""),
			removedImage{}, ""},
		{"outside the bucket", finds(map[storage.PhotoRef]storage.Uploaded{ref: {URL: "https://cdn/a.jpg"}}, ""), deletes(""),
			removedImage{Message: "The image is outside the R2 bucket, so it was left as is."}, ""},
		{"can't search", finds(nil, "Fill in Bucket first."), deletes(""),
			removedImage{Message: "Couldn't look in R2, so the image was left there: Fill in Bucket first."}, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			deletedKey = ""
			got, err := removeImage(t.Context(), store, tt.find, tt.delete, removed)
			if err != nil || got != tt.want || deletedKey != tt.deleted {
				t.Errorf("removeImage() = %+v, %v, deleted %q; want %+v, deleted %q", got, err, deletedKey, tt.want, tt.deleted)
			}
		})
	}
}

func TestRemoveInFlightNeedsPath(t *testing.T) {
	router := NewRouter(nil, settings.NewStore(filepath.Join(t.TempDir(), "settings.json")))
	req := httptest.NewRequestWithContext(t.Context(), http.MethodDelete, "/photos/in-flight", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "path is required") {
		t.Errorf("status = %d, body %s; want 400 asking for a path", rec.Code, rec.Body)
	}
}

func TestCombineStatusNotSetUp(t *testing.T) {
	router := NewRouter(nil, settings.NewStore(filepath.Join(t.TempDir(), "settings.json")))
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/photos/in-flight/ci?sha=abc1234", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "Settings first") {
		t.Errorf("status = %d, body %s; want 400 asking for settings", rec.Code, rec.Body)
	}
}
