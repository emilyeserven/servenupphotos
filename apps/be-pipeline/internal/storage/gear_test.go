package storage

import (
	"bytes"
	"errors"
	"image"
	"image/color"
	"image/png"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// gearR2 is validR2 with a public URL, so uploads have links.
var gearR2 = func() settings.R2 {
	cfg := validR2
	cfg.PublicURL = "https://cdn.example/"
	return cfg
}()

func TestUploadGearImage(t *testing.T) {
	f := &fakeR2Upload{status: http.StatusOK}
	endpoint := f.start(t)
	encode := func(picture io.Reader) ([]byte, error) {
		data, err := io.ReadAll(picture)
		return append([]byte("webp:"), data...), err
	}
	got, err := uploadGearImage(t.Context(), gearR2, endpoint, "My X-T5.png", strings.NewReader("pixels"), encode)
	if err != nil {
		t.Fatalf("uploadGearImage() error = %v", err)
	}
	if !strings.HasPrefix(got.Key, "gear/") || !strings.HasSuffix(got.Key, "-my-x-t5.webp") {
		t.Errorf("key = %q, want gear/<hash>-my-x-t5.webp", got.Key)
	}
	if got.URL != "https://cdn.example/"+got.Key {
		t.Errorf("URL = %q", got.URL)
	}
	if f.contentType != "image/webp" || string(f.body) != "webp:pixels" || f.listed {
		t.Errorf("put %s %q (listed %v), want the encoded WEBP and no listing", f.contentType, f.body, f.listed)
	}
}

func TestUploadGearImageProblems(t *testing.T) {
	failing := func(io.Reader) ([]byte, error) { return nil, errors.New("not an image") }
	var uerr *UploadError
	_, err := uploadGearImage(t.Context(), gearR2, "http://unused", "a.png", strings.NewReader("x"), failing)
	if !errors.As(err, &uerr) || !uerr.NotAPhoto {
		t.Errorf("unreadable picture: error = %v, want NotAPhoto", err)
	}
	empty := gearR2
	empty.Bucket = ""
	_, err = uploadGearImage(t.Context(), empty, "http://unused", "a.png", strings.NewReader("x"), failing)
	if !errors.As(err, &uerr) || !uerr.NotConfigured {
		t.Errorf("no bucket: error = %v, want NotConfigured", err)
	}
}

func TestEncodeGearImageShrinksAPNG(t *testing.T) {
	img := image.NewNRGBA(image.Rect(0, 0, 1600, 400))
	img.Set(10, 10, color.NRGBA{R: 255, A: 128})
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	data, err := encodeGearImage(&buf)
	if err != nil {
		t.Fatalf("encodeGearImage() error = %v", err)
	}
	cfg, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || format != "webp" || cfg.Width != 800 || cfg.Height != 200 {
		t.Errorf("encoded %s %dx%d (%v), want an 800x200 webp", format, cfg.Width, cfg.Height, err)
	}
}
