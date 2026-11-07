package httpapi

import (
	"context"
	"errors"
	"image"
	"image/color"
	"os"
	"path/filepath"
	"testing"

	"github.com/gen2brain/webp"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/phash"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// writeWebp saves a small striped WEBP in dir and returns its path.
func writeWebp(t *testing.T, dir string) string {
	t.Helper()
	img := image.NewNRGBA(image.Rect(0, 0, 90, 60))
	for y := range 60 {
		for x := range 90 {
			img.Set(x, y, color.NRGBA{R: uint8((x / 10 % 2) * 255), A: 255}) //nolint:gosec // 0 or 255
		}
	}
	path := filepath.Join(dir, "small.webp")
	f, err := os.Create(path) //nolint:gosec // a test file
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close() //nolint:errcheck // test
	if err := webp.Encode(f, img, webp.Options{Quality: 90}); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestHashReaderReadsTheSmallVersionOnce(t *testing.T) {
	path := writeWebp(t, t.TempDir())
	downloads := 0
	file := func(_ context.Context, _ settings.R2, _ string) (string, error) {
		downloads++
		return path, nil
	}
	r2 := func() (settings.R2, error) { return settings.R2{}, nil }
	read := hashReader(r2, file, newKeyCache[string]())
	first, msg := read(t.Context(), "https://cdn.example.com/photos/a-small.webp")
	if msg != "" {
		t.Fatalf("read failed: %s", msg)
	}
	if _, ok := phash.Parse(first); !ok {
		t.Errorf("hash = %q, want 16 hex digits", first)
	}
	again, _ := read(t.Context(), "https://cdn.example.com/photos/a-small.webp")
	if again != first || downloads != 1 {
		t.Errorf("second read = %q after %d downloads, want %q from the cache", again, downloads, first)
	}
}

func TestHashReaderWithoutTheSmallVersion(t *testing.T) {
	file := func(context.Context, settings.R2, string) (string, error) { return "", errors.New("not found") }
	r2 := func() (settings.R2, error) { return settings.R2{}, nil }
	if h, msg := hashReader(r2, file, newKeyCache[string]())(t.Context(), "https://x/photos/a-small.webp"); h != "" || msg == "" {
		t.Errorf("read = %q, %q; want a message", h, msg)
	}
	small := ""
	if photoHash(t.Context(), nil, &small) != nil {
		t.Error("photoHash with no Small version should be nil")
	}
}
