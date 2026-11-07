package storage

import (
	"bytes"
	"errors"
	"image"
	"image/color"
	"image/png"
	"io"
	"net/http"
	"net/http/httptest"
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

// gearPNG is a w by h PNG, red with a transparent pixel at its top left.
func gearPNG(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	for y := range h {
		for x := range w {
			img.Set(x, y, color.NRGBA{R: 255, A: 255})
		}
	}
	img.Set(0, 0, color.NRGBA{})
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func TestUploadGearOriginal(t *testing.T) {
	f := &fakeR2Upload{status: http.StatusOK}
	endpoint := f.start(t)
	picture := gearPNG(t, 40, 30)
	got, err := uploadGearOriginal(t.Context(), gearR2, endpoint, "My X-T5.png", bytes.NewReader(picture))
	if err != nil {
		t.Fatalf("uploadGearOriginal() error = %v", err)
	}
	if !strings.HasPrefix(got.Key, "gear/originals/") || !strings.HasSuffix(got.Key, "-my-x-t5.png") {
		t.Errorf("key = %q, want gear/originals/<hash>-my-x-t5.png", got.Key)
	}
	if got.URL != "https://cdn.example/"+got.Key || got.Width != 40 || got.Height != 30 {
		t.Errorf("got %+v, want its link and a 40x30 size", got)
	}
	if f.contentType != "image/png" || !bytes.Equal(f.body, picture) {
		t.Errorf("put %s, %d bytes; want the PNG unchanged", f.contentType, len(f.body))
	}
}

func TestUploadGearOriginalProblems(t *testing.T) {
	var uerr *UploadError
	_, err := uploadGearOriginal(t.Context(), gearR2, "http://unused", "a.png", strings.NewReader("not a picture"))
	if !errors.As(err, &uerr) || !uerr.NotAPhoto {
		t.Errorf("unreadable picture: error = %v, want NotAPhoto", err)
	}
	empty := gearR2
	empty.Bucket = ""
	_, err = uploadGearOriginal(t.Context(), empty, "http://unused", "a.png", strings.NewReader("x"))
	if !errors.As(err, &uerr) || !uerr.NotConfigured {
		t.Errorf("no bucket: error = %v, want NotConfigured", err)
	}
}

// fakeR2Gear answers a GET with picture and keeps the body of a PUT.
type fakeR2Gear struct {
	picture []byte
	got     string
	put     []byte
}

func (f *fakeR2Gear) start(t *testing.T) string {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			f.got = r.URL.Path
			_, _ = w.Write(f.picture)
			return
		}
		f.put, _ = io.ReadAll(r.Body)
	}))
	t.Cleanup(srv.Close)
	return srv.URL
}

func TestCropGearImage(t *testing.T) {
	f := &fakeR2Gear{picture: gearPNG(t, 400, 300)}
	endpoint := f.start(t)
	crop := GearCrop{X: -0.25, Y: 0, Width: 1.5, Height: 1.5}
	got, err := cropGearImage(t.Context(), gearR2, endpoint, "https://cdn.example/gear/originals/abc123-my-x-t5.png", crop)
	if err != nil {
		t.Fatalf("cropGearImage() error = %v", err)
	}
	if !strings.HasSuffix(f.got, "/gear/originals/abc123-my-x-t5.png") {
		t.Errorf("read %q, want the original", f.got)
	}
	if !strings.HasPrefix(got.Key, "gear/") || !strings.HasSuffix(got.Key, "-my-x-t5.webp") || strings.Contains(got.Key, "originals") {
		t.Errorf("key = %q, want gear/<hash>-my-x-t5.webp", got.Key)
	}
	img, format, err := image.Decode(bytes.NewReader(f.put))
	if err != nil || format != "webp" || img.Bounds().Dx() != GearCropWidth || img.Bounds().Dy() != GearCropHeight {
		t.Fatalf("put %s (%v), want a %dx%d webp", format, err, GearCropWidth, GearCropHeight)
	}
	if _, _, _, a := img.At(10, 100).RGBA(); a != 0 {
		t.Errorf("left of the picture has alpha %d, want transparent", a)
	}
	crop.Fill = "white"
	if _, err := cropGearImage(t.Context(), gearR2, endpoint, "https://cdn.example/gear/originals/abc123-my-x-t5.png", crop); err != nil {
		t.Fatalf("cropGearImage(white) error = %v", err)
	}
	white, _, _ := image.Decode(bytes.NewReader(f.put))
	// Go reads lossy WEBP's limited-range colors as full-range, so white
	// comes back as about 236 of 255; a browser shows it white.
	if r, g, b, a := white.At(2, 2).RGBA(); r < 0xe800 || g < 0xe800 || b < 0xe800 || a < 0xf000 {
		t.Errorf("left of the picture is %d %d %d %d, want white", r, g, b, a)
	}
	if r, _, _, a := img.At(130, 60).RGBA(); a == 0 || r == 0 {
		t.Errorf("middle is %d alpha %d, want the red picture", r, a)
	}
}

func TestCropGearImageProblems(t *testing.T) {
	var uerr *UploadError
	whole := GearCrop{Width: 1, Height: 1}
	for name, tc := range map[string]struct {
		original string
		crop     GearCrop
	}{
		"another bucket":   {"https://elsewhere.example/gear/a.png", whole},
		"not a gear photo": {"https://cdn.example/photos/a.jpg", whole},
		"no size":          {"https://cdn.example/gear/a.png", GearCrop{}},
		"odd fill":         {"https://cdn.example/gear/a.png", GearCrop{Width: 1, Height: 1, Fill: "plaid"}},
	} {
		_, err := cropGearImage(t.Context(), gearR2, "http://unused", tc.original, tc.crop)
		if !errors.As(err, &uerr) {
			t.Errorf("%s: error = %v, want an UploadError", name, err)
		}
	}
}
