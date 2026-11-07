package phash

import (
	"image"
	"image/color"
	"testing"

	"github.com/disintegration/imaging"
)

// gradient is a w×h photo going from dark on the left to light on the right,
// with a bright square at (sx, sy).
func gradient(w, h, sx, sy int) image.Image {
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	for y := range h {
		for x := range w {
			v := uint8(x * 200 / w) //nolint:gosec // at most 200
			if x >= sx && x < sx+w/4 && y >= sy && y < sy+h/4 {
				v = 255
			}
			img.Set(x, y, color.NRGBA{R: v, G: v / 2, B: 255 - v, A: 255})
		}
	}
	return img
}

func TestOfFindsTheSameLookAtAnotherSize(t *testing.T) {
	a := gradient(400, 300, 50, 50)
	resized := imaging.Resize(a, 200, 150, imaging.Lanczos)
	brighter := imaging.AdjustBrightness(a, 8)
	for name, b := range map[string]image.Image{"resized": resized, "brighter": brighter} {
		if d := Distance(Of(a), Of(b)); d > Near {
			t.Errorf("%s: distance %d, want at most %d", name, d, Near)
		}
	}
}

func TestOfTellsDifferentPhotosApart(t *testing.T) {
	a := gradient(400, 300, 50, 50)
	b := imaging.FlipH(gradient(400, 300, 250, 200))
	if d := Distance(Of(a), Of(b)); d <= Near {
		t.Errorf("distance %d, want more than %d", d, Near)
	}
}

func TestFormatAndParse(t *testing.T) {
	for _, hash := range []uint64{0, 1, 0xdeadbeefcafef00d, ^uint64(0)} {
		got, ok := Parse(Format(hash))
		if !ok || got != hash {
			t.Errorf("Parse(Format(%x)) = %x, %v", hash, got, ok)
		}
	}
	for _, bad := range []string{"", "abc", "zzzzzzzzzzzzzzzz", "00000000000000000"} {
		if _, ok := Parse(bad); ok {
			t.Errorf("Parse(%q) ok, want false", bad)
		}
	}
}
