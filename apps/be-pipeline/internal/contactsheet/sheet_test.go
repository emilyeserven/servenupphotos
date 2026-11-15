package contactsheet

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"testing"

	"golang.org/x/image/font"
)

// solid is a w × h picture filled with c.
func solid(w, h int, c color.Color) image.Image {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := range h {
		for x := range w {
			img.Set(x, y, c)
		}
	}
	return img
}

func TestSize(t *testing.T) {
	for _, tc := range []struct{ n, w, h int }{
		{1, 256, 286},
		{6, 1496, 286},
		{7, 1496, 564},
		{30, 1496, 1398},
	} {
		if w, h := Size(tc.n); w != tc.w || h != tc.h {
			t.Errorf("Size(%d) = %d × %d, want %d × %d", tc.n, w, h, tc.w, tc.h)
		}
	}
}

func TestSplit(t *testing.T) {
	tiles := make([]Tile, 65)
	sheets := Split(tiles)
	if len(sheets) != 3 || len(sheets[0]) != 30 || len(sheets[2]) != 5 {
		t.Errorf("Split(65) gave %d sheets, want 30 + 30 + 5", len(sheets))
	}
	if Split(nil) != nil {
		t.Error("Split(nil) should give no sheets")
	}
}

func TestDraw(t *testing.T) {
	red := color.RGBA{R: 0xff, A: 0xff}
	// A wide photo fits the tile's width and is centered top to bottom.
	sheet := Draw([]Tile{
		{Number: 1, Label: "20161216_092741", Image: solid(480, 240, red)},
		{Number: 2, Label: "gone", Image: nil},
	})
	if got := sheet.Bounds().Size(); got != image.Pt(504, 286) {
		t.Fatalf("size = %v, want 504 × 286", got)
	}
	if got := sheet.RGBAAt(gap+120, gap+120); got != red {
		t.Errorf("middle of the first tile = %v, want the photo's red", got)
	}
	if got := sheet.RGBAAt(gap+120, gap+10); got != background {
		t.Errorf("above the wide photo = %v, want the background", got)
	}
	second := gap*2 + tileEdge
	if got := sheet.RGBAAt(second+5, gap+5); got != missingBox {
		t.Errorf("a missing photo's tile = %v, want the gray box", got)
	}
	// The label strip has the number's ink in it.
	if !hasInk(sheet, image.Rect(gap, gap+tileEdge, gap+40, gap+tileEdge+labelSize), numberInk) {
		t.Error("the first tile's number wasn't drawn")
	}
}

// hasInk reports whether any pixel in r is ink.
func hasInk(img *image.RGBA, r image.Rectangle, ink color.RGBA) bool {
	for y := r.Min.Y; y < r.Max.Y; y++ {
		for x := r.Min.X; x < r.Max.X; x++ {
			if img.RGBAAt(x, y) == ink {
				return true
			}
		}
	}
	return false
}

func TestFit(t *testing.T) {
	_, regular := faces()
	if got := Fit(regular, "short", 200); got != "short" {
		t.Errorf("Fit(short) = %q", got)
	}
	long := "a-very-long-photo-name-that-will-not-fit"
	got := Fit(regular, long, 100)
	if got == long || got == "" || font.MeasureString(regular, got).Round() > 100 || got[len(got)-len("…"):] != "…" {
		t.Errorf("Fit(long, 100) = %q, want it shortened with …", got)
	}
	if got := Fit(regular, long, 1); got != "" {
		t.Errorf("Fit(long, 1) = %q, want \"\"", got)
	}
}

func TestEncode(t *testing.T) {
	data, err := Encode(Draw([]Tile{{Number: 1, Label: "x", Image: solid(10, 10, color.White)}}))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := jpeg.Decode(bytes.NewReader(data)); err != nil {
		t.Errorf("not a JPEG: %v", err)
	}
}
