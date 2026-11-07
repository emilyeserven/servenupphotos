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

	"github.com/gen2brain/avif"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/versions"
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
	if got.URL != "https://cdn.example/"+got.Key || got.Width != 40 || got.Height != 30 || got.Subject.Width != 1 {
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

func TestUploadGearOriginalAVIF(t *testing.T) {
	img := image.NewNRGBA(image.Rect(0, 0, 64, 16))
	var buf bytes.Buffer
	if err := avif.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	if got := GearPictureType(buf.Bytes()); got != "image/avif" {
		t.Fatalf("GearPictureType(avif) = %q", got)
	}
	f := &fakeR2Upload{status: http.StatusOK}
	got, err := uploadGearOriginal(t.Context(), gearR2, f.start(t), "lens.avif", &buf)
	if err != nil || !strings.HasSuffix(got.Key, "-lens.avif") || got.Width != 64 || got.Height != 16 {
		t.Fatalf("uploadGearOriginal(avif) = %+v, %v; want a 64x16 .avif", got, err)
	}
	if f.contentType != "image/avif" {
		t.Errorf("content type = %q", f.contentType)
	}
}

// Store pages' pictures come in every shape and size: a crop of each fills
// the whole frame, scaling a tiny one up and a long one down.
func TestCutOutOddSizes(t *testing.T) {
	for name, size := range map[string]image.Point{"tiny": {30, 20}, "long": {4000, 100}, "tall": {100, 4000}, "huge square": {3000, 3000}} {
		img := image.NewNRGBA(image.Rect(0, 0, size.X, size.Y))
		// The whole picture, centered, as the page's first crop has it.
		aspect := float64(GearCropWidth) / GearCropHeight
		part := versions.Part{X: 0, Y: 0, Width: 1, Height: 1}
		if float64(size.X)/float64(size.Y) > aspect {
			part.Height = float64(size.X) / aspect / float64(size.Y)
			part.Y = (1 - part.Height) / 2
		} else {
			part.Width = float64(size.Y) * aspect / float64(size.X)
			part.X = (1 - part.Width) / 2
		}
		got, ok := versions.CutOut(img, part, GearCropWidth, GearCropHeight, color.White)
		if !ok || got.Bounds().Dx() != GearCropWidth || got.Bounds().Dy() != GearCropHeight {
			t.Errorf("%s: CutOut() = %v, %v; want %dx%d", name, got.Bounds(), ok, GearCropWidth, GearCropHeight)
		}
	}
}

func TestGearPictureType(t *testing.T) {
	for want, head := range map[string]string{
		"image/png": "\x89PNG\r\n\x1a\n", "image/gif": "GIF89a", "image/bmp": "BM", "image/tiff": "II*\x00",
		"": "hello",
	} {
		if got := GearPictureType([]byte(head + "rest of the picture")); got != want {
			t.Errorf("GearPictureType(%q) = %q, want %q", head, got, want)
		}
	}
}
