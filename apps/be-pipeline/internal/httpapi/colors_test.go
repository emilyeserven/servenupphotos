package httpapi

import (
	"bytes"
	"context"
	"io"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/colors"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

func TestColorReader(t *testing.T) {
	cfg := func() (settings.R2, error) { return settings.R2{Bucket: "photos"}, nil }
	photo := redJPEG(t)
	downloads := 0
	get := func(_ context.Context, _ settings.R2, key string) (io.ReadCloser, error) {
		downloads++
		if key == "photos/gone.jpg" {
			return nil, &storage.GetError{Message: "That photo isn't in the bucket anymore.", NotFound: true}
		}
		return io.NopCloser(bytes.NewReader(photo)), nil
	}
	read := colorReader(cfg, get, newKeyCache[colors.Analysis]())

	for range 2 {
		got, msg := read(t.Context(), "photos/ab-red.jpg")
		if msg != "" || got.Buckets[0].Name != "red" || got.Buckets[0].Share < 0.99 {
			t.Fatalf("read() = %+v, %q; want red", got, msg)
		}
	}
	if downloads != 1 {
		t.Errorf("downloaded %d times, want once and then from the cache", downloads)
	}
	if _, msg := read(t.Context(), "photos/gone.jpg"); msg != "That photo isn't in the bucket anymore." {
		t.Errorf("read() of a missing photo = %q", msg)
	}
}
