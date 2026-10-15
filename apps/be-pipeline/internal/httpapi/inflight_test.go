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
