package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// postImageSizes sends body to h.
func postImageSizes(t *testing.T, h http.HandlerFunc, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/photos/bucket/sizes", strings.NewReader(body))
	rec := httptest.NewRecorder()
	h(rec, req)
	return rec
}

func TestImageSizes(t *testing.T) {
	var reads atomic.Int32
	read := func(_ context.Context, _ settings.R2, url string) (imageSize, error) {
		reads.Add(1)
		if strings.Contains(url, "broken") {
			return imageSize{}, errors.New("not a webp")
		}
		return imageSize{Width: 640, Height: 360}, nil
	}
	h := handleImageSizes(func() (settings.R2, error) { return settings.R2{}, nil }, read)
	body := `{"urls":["https://cdn.example/a-small.webp","https://cdn.example/broken-small.webp"]}`

	rec := postImageSizes(t, h, body)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body)
	}
	var got imageSizesResponse
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	if len(got.Images) != 2 {
		t.Fatalf("got %d images, want 2", len(got.Images))
	}
	if a := got.Images[0]; a.Width != 640 || a.Height != 360 || a.Error != "" {
		t.Errorf("first = %+v, want 640 × 360", a)
	}
	if b := got.Images[1]; b.Error == "" || b.Width != 0 {
		t.Errorf("second = %+v, want an error", b)
	}

	// The size read is kept, so asking again only retries the broken one.
	postImageSizes(t, h, body)
	if n := reads.Load(); n != 3 {
		t.Errorf("reads = %d, want 3", n)
	}
}

func TestImageSizesNeedsURLs(t *testing.T) {
	h := handleImageSizes(func() (settings.R2, error) { return settings.R2{}, nil }, nil)
	if rec := postImageSizes(t, h, `{"urls":[]}`); rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestReadImageSizeOnlySmallVersions(t *testing.T) {
	read := readImageSize(func(context.Context, settings.R2, string) (string, error) {
		t.Fatal("asked the offline copy for a link that isn't a Small version")
		return "", nil
	})
	if _, err := read(t.Context(), settings.R2{}, "https://example.com/cat.jpg"); err == nil {
		t.Error("want an error for a link that isn't a Small version in R2")
	}
}
