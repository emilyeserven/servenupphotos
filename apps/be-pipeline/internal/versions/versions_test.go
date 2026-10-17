package versions

import (
	"bytes"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"testing"

	"github.com/gen2brain/webp"
)

// testJPEG encodes a w×h JPEG.
func testJPEG(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	draw.Draw(img, img.Bounds(), &image.Uniform{C: color.RGBA{200, 120, 60, 255}}, image.Point{}, draw.Src)
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, nil); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

// withOrientation inserts an EXIF segment with the given orientation after
// the JPEG's start-of-image marker.
func withOrientation(photo []byte, orientation byte) []byte {
	tiff := []byte{
		'M', 'M', 0, 42, 0, 0, 0, 8, // big-endian header, first IFD at 8
		0, 1, // one entry
		0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0, // Orientation, SHORT
		0, 0, 0, 0, // no next IFD
	}
	payload := append([]byte("Exif\x00\x00"), tiff...)
	// APP1 marker, then the segment length: the payload plus the two length bytes.
	segment := append([]byte{0xFF, 0xE1, 0, 34}, payload...)
	if len(payload)+2 != 34 {
		panic("EXIF segment length is out of date")
	}
	out := append([]byte{}, photo[:2]...)
	out = append(out, segment...)
	return append(out, photo[2:]...)
}

func size(t *testing.T, data []byte) image.Point {
	t.Helper()
	cfg, err := webp.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		t.Fatalf("not a WEBP: %v", err)
	}
	return image.Pt(cfg.Width, cfg.Height)
}

func TestEncodeAllFitsLongestEdge(t *testing.T) {
	for _, tc := range []struct {
		name string
		w, h int
		want map[string]image.Point
	}{
		{"landscape", 3000, 2000, map[string]image.Point{
			"xlarge": {1800, 1200}, "large": {1200, 800}, "medium": {500, 333}, "small": {250, 166},
		}},
		{"portrait", 1000, 2000, map[string]image.Point{
			"xlarge": {900, 1800}, "large": {600, 1200}, "medium": {250, 500}, "small": {125, 250},
		}},
		{"smaller than xlarge", 1500, 1000, map[string]image.Point{
			"xlarge": {1500, 1000}, "large": {1200, 800}, "medium": {500, 333}, "small": {250, 166},
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			encoded, err := EncodeAll(bytes.NewReader(testJPEG(t, tc.w, tc.h)))
			if err != nil {
				t.Fatal(err)
			}
			if len(encoded) != len(All) {
				t.Fatalf("got %d versions, want %d", len(encoded), len(All))
			}
			for _, e := range encoded {
				if got := size(t, e.Data); got != tc.want[e.Name] {
					t.Errorf("%s = %v, want %v", e.Name, got, tc.want[e.Name])
				}
			}
		})
	}
}

func TestEncodeAllTurnsUpright(t *testing.T) {
	// Orientation 6: stored landscape, shown rotated 90° clockwise.
	photo := withOrientation(testJPEG(t, 600, 400), 6)
	encoded, err := EncodeAll(bytes.NewReader(photo))
	if err != nil {
		t.Fatal(err)
	}
	if got, want := size(t, encoded[2].Data), image.Pt(333, 500); got != want {
		t.Errorf("medium = %v, want %v", got, want)
	}
}

func TestEncodeAllRejectsNonJPEG(t *testing.T) {
	if _, err := EncodeAll(bytes.NewReader([]byte("not a photo"))); err == nil {
		t.Error("want an error")
	}
}

func TestFind(t *testing.T) {
	if v, ok := Find("medium"); !ok || v.MaxEdge != 500 {
		t.Errorf("Find(medium) = %v, %v", v, ok)
	}
	if _, ok := Find("huge"); ok {
		t.Error("Find(huge) found a version")
	}
}

func TestJPEGSize(t *testing.T) {
	img, err := Decode(bytes.NewReader(testJPEG(t, 600, 400)))
	if err != nil {
		t.Fatal(err)
	}
	if n, err := JPEGSize(Resize(img, All[2]), 90); err != nil || n == 0 {
		t.Errorf("JPEGSize = %d, %v", n, err)
	}
}

func TestJPEGQuality(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 32, 32))
	for _, want := range []int{50, 75, 90, 95, 100} {
		var buf bytes.Buffer
		if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: want}); err != nil {
			t.Fatal(err)
		}
		got, ok := JPEGQuality(bytes.NewReader(buf.Bytes()))
		if !ok || got < want-1 || got > want+1 {
			t.Errorf("quality %d: got %d, %v", want, got, ok)
		}
	}
	if _, ok := JPEGQuality(bytes.NewReader([]byte("not a jpeg"))); ok {
		t.Error("found a quality in a non-JPEG")
	}
}
