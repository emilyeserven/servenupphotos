package storage

import (
	"bytes"
	"errors"
	"image"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// fakeR2Puts keeps the path and body of every PUT.
type fakeR2Puts struct {
	paths  []string
	bodies [][]byte
}

func (f *fakeR2Puts) start(t *testing.T) string {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		f.paths = append(f.paths, r.URL.Path)
		f.bodies = append(f.bodies, body)
	}))
	t.Cleanup(srv.Close)
	return srv.URL
}

func TestUploadBioPortrait(t *testing.T) {
	f := &fakeR2Puts{}
	endpoint := f.start(t)
	got, err := uploadBioPortrait(t.Context(), gearR2, endpoint, "Me at Seoul.png", bytes.NewReader(gearPNG(t, 2400, 1200)))
	if err != nil {
		t.Fatalf("uploadBioPortrait() error = %v", err)
	}
	if !strings.HasPrefix(got.Image, "https://cdn.example/bio/") || !strings.HasSuffix(got.Image, "-me-at-seoul.webp") {
		t.Errorf("image = %q, want https://cdn.example/bio/<hash>-me-at-seoul.webp", got.Image)
	}
	if !strings.HasSuffix(got.Small, "-me-at-seoul-small.webp") || got.Width != 1800 || got.Height != 900 {
		t.Errorf("got %+v, want a small link and an 1800x900 size", got)
	}
	// Only the two WEBP versions are put in the bucket, not the picture as
	// uploaded.
	if len(f.paths) != 2 {
		t.Fatalf("put %v, want two versions", f.paths)
	}
	small, format, err := image.Decode(bytes.NewReader(f.bodies[1]))
	if err != nil || format != "webp" || small.Bounds().Dx() != 500 || small.Bounds().Dy() != 250 {
		t.Errorf("small version is %s (%v), want a 500x250 webp", format, err)
	}
}

func TestUploadBioPortraitProblems(t *testing.T) {
	var uerr *UploadError
	_, err := uploadBioPortrait(t.Context(), gearR2, "http://unused", "a.png", strings.NewReader("not a picture"))
	if !errors.As(err, &uerr) || !uerr.NotAPhoto {
		t.Errorf("unreadable picture: error = %v, want NotAPhoto", err)
	}
	empty := gearR2
	empty.Bucket = ""
	_, err = uploadBioPortrait(t.Context(), empty, "http://unused", "a.png", strings.NewReader("x"))
	if !errors.As(err, &uerr) || !uerr.NotConfigured {
		t.Errorf("no bucket: error = %v, want NotConfigured", err)
	}
}
