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
		{Path: "data/b.json", PhotoName: "B.jpg"},
	}
	found := func(_ context.Context, _ settings.R2, names []string) (map[string]storage.Uploaded, string) {
		if len(names) != 2 || names[0] != "A.jpg" || names[1] != "B.jpg" {
			t.Errorf("names = %v, want A.jpg, B.jpg", names)
		}
		return map[string]storage.Uploaded{"A.jpg": {Key: "photos/a.jpg", URL: "https://pub/photos/a.jpg"}}, ""
	}
	images, err := findImages(t.Context(), store, found, files)
	if err != nil {
		t.Fatal(err)
	}
	if !images.Checked || len(images.ByPath) != 1 || images.ByPath["data/a.json"].Key != "photos/a.jpg" {
		t.Errorf("images = %+v, want a.json's image only", images)
	}

	broken := func(context.Context, settings.R2, []string) (map[string]storage.Uploaded, string) {
		return nil, "Fill in Bucket first."
	}
	images, err = findImages(t.Context(), store, broken, files)
	if err != nil || images.Checked || images.Message != "Fill in Bucket first." {
		t.Errorf("images = %+v, %v; want unchecked with the problem", images, err)
	}
}
