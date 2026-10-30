package offline

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

const square = "https://cdn.example.net/photos/233d38afbc8e-img-0001-thumbnail.webp"

// fakeR2 answers every key with its own name as the image, counting the
// downloads, or fails every one with fail.
func fakeR2(fail error) (GetFunc, *atomic.Int32) {
	var calls atomic.Int32
	return func(_ context.Context, _ settings.R2, key string) (io.ReadCloser, error) {
		calls.Add(1)
		if fail != nil {
			return nil, fail
		}
		return io.NopCloser(strings.NewReader("image of " + key)), nil
	}, &calls
}

func TestThumbnailKey(t *testing.T) {
	tests := map[string]string{
		square: "photos/233d38afbc8e-img-0001-thumbnail.webp",
		"https://pub-1.r2.dev/photos/233d38afbc8e-thumbnailpreview.webp?crop=1,2,3": "photos/233d38afbc8e-thumbnailpreview.webp",
		"https://cdn.example.net/photos/233d38afbc8e-img-0001.jpg":                  "",
		"https://cdn.example.net/photos/233d38afbc8e-large.webp":                    "",
		"https://cdn.example.net/other/a-thumbnail.webp":                            "",
		"file:///photos/a-thumbnail.webp":                                           "",
	}
	for raw, want := range tests {
		key, ok := ThumbnailKey(raw)
		if ok != (want != "") || (ok && key != want) {
			t.Errorf("ThumbnailKey(%q) = %q, %v; want %q", raw, key, ok, want)
		}
	}
}

func TestThumbnailDownloadsOnce(t *testing.T) {
	get, calls := fakeR2(nil)
	c := New(t.TempDir(), get)
	for range 2 {
		path, err := c.Thumbnail(t.Context(), settings.R2{}, square)
		if err != nil {
			t.Fatal(err)
		}
		got, _ := os.ReadFile(path) //nolint:gosec // a path in the test's own folder
		if string(got) != "image of photos/233d38afbc8e-img-0001-thumbnail.webp" {
			t.Errorf("file = %q", got)
		}
	}
	if calls.Load() != 1 {
		t.Errorf("downloads = %d, want 1", calls.Load())
	}
	// A remade Square Thumbnail, marked with its new crop, is downloaded again.
	if _, err := c.Thumbnail(t.Context(), settings.R2{}, square+"?crop=0,0,100"); err != nil || calls.Load() != 2 {
		t.Errorf("remade: err %v, downloads %d; want a second download", err, calls.Load())
	}
}

func TestThumbnailOffline(t *testing.T) {
	offline := &storage.GetError{Message: "Couldn't reach R2."}
	get, _ := fakeR2(offline)
	c := New(t.TempDir(), get)
	if _, err := c.Thumbnail(t.Context(), settings.R2{}, square); !errors.Is(err, offline) {
		t.Errorf("err = %v, want R2's", err)
	}
	if c.Has(square) {
		t.Error("a failed download left a file")
	}
	if _, err := c.Thumbnail(t.Context(), settings.R2{}, "https://cdn.example.net/photos/a.jpg"); !errors.Is(err, ErrNotThumbnail) {
		t.Errorf("err = %v, want ErrNotThumbnail", err)
	}
}

func TestWarm(t *testing.T) {
	get, calls := fakeR2(nil)
	c := New(t.TempDir(), get)
	preview := strings.Replace(square, "-thumbnail.", "-thumbnailpreview.", 1)
	if _, err := c.Thumbnail(t.Context(), settings.R2{}, square); err != nil {
		t.Fatal(err)
	}
	downloaded, failed := c.Warm(t.Context(), settings.R2{}, []string{square, preview, preview, "https://x/notes.txt"})
	if downloaded != 1 || failed != 1 || calls.Load() != 2 {
		t.Errorf("downloaded %d, failed %d, calls %d; want the preview downloaded once and notes.txt failed", downloaded, failed, calls.Load())
	}
}

func TestFindKeepsImagesForOffline(t *testing.T) {
	c := New(t.TempDir(), nil)
	a := storage.PhotoRef{Name: "A.jpg"}
	b := storage.PhotoRef{Name: "B.jpg", Key: "photos/b.jpg"}
	image := storage.Uploaded{Key: "photos/a.jpg", URL: "https://cdn/photos/a.jpg"}
	online := c.Find(func(context.Context, settings.R2, []storage.PhotoRef) (map[storage.PhotoRef]storage.Uploaded, string) {
		return map[storage.PhotoRef]storage.Uploaded{a: image}, ""
	})
	if found, problem := online(t.Context(), settings.R2{}, []storage.PhotoRef{a, b}); problem != "" || found[a] != image {
		t.Fatalf("online = %v, %q", found, problem)
	}

	// A new copy reads what the last one kept, as after a restart.
	c = New(c.dir, nil)
	offline := c.Find(func(context.Context, settings.R2, []storage.PhotoRef) (map[storage.PhotoRef]storage.Uploaded, string) {
		return nil, "Couldn't reach R2."
	})
	found, problem := offline(t.Context(), settings.R2{}, []storage.PhotoRef{a, b})
	if !reflect.DeepEqual(found, map[storage.PhotoRef]storage.Uploaded{a: image}) || problem != "Couldn't reach R2. "+Note {
		t.Errorf("offline = %v, %q; want a's saved image and the note", found, problem)
	}
	if found, problem := offline(t.Context(), settings.R2{}, []storage.PhotoRef{b}); found != nil || problem != "Couldn't reach R2." {
		t.Errorf("nothing saved = %v, %q; want just the problem", found, problem)
	}
}

func TestThumbnailURLs(t *testing.T) {
	saved := json.RawMessage(`{"images":{"thumbnail":"https://cdn/photos/a-thumbnail.webp?crop=1,2,3"}}`)
	got := ThumbnailURLs(saved, "https://cdn/photos/a.jpg")
	want := []string{"https://cdn/photos/a-thumbnail.webp?crop=1,2,3", "https://cdn/photos/a-thumbnailpreview.webp"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("ThumbnailURLs = %v, want %v", got, want)
	}
	if got := ThumbnailURLs(nil, ""); got != nil {
		t.Errorf("without an image = %v, want none", got)
	}
}
