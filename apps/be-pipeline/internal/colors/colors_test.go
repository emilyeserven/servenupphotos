package colors

import (
	"image"
	"image/color"
	"os"
	"testing"
)

func solid(c color.Color, w, h int) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := range h {
		for x := range w {
			img.Set(x, y, c)
		}
	}
	return img
}

func TestSolidColor(t *testing.T) {
	a, err := analyzeImage(solid(color.RGBA{255, 0, 0, 255}, 50, 40))
	if err != nil {
		t.Fatal(err)
	}
	if a.Average.Hex != "#ff0000" {
		t.Errorf("average = %s, want #ff0000", a.Average.Hex)
	}
	if len(a.Palette) != 1 || a.Palette[0].Hex != "#ff0000" || a.Palette[0].Share != 1 {
		t.Errorf("palette = %+v, want one red swatch covering everything", a.Palette)
	}
	if a.Samples != 2000 {
		t.Errorf("samples = %d, want 2000", a.Samples)
	}
}

func TestTwoColorsSortedByShare(t *testing.T) {
	img := solid(color.RGBA{0, 0, 255, 255}, 100, 100)
	for y := range 25 {
		for x := range 100 {
			img.Set(x, y, color.White)
		}
	}
	a, err := analyzeImage(img)
	if err != nil {
		t.Fatal(err)
	}
	if len(a.Palette) != 2 {
		t.Fatalf("palette has %d colors, want 2: %+v", len(a.Palette), a.Palette)
	}
	if a.Palette[0].Hex != "#0000ff" || a.Palette[0].Share != 0.75 {
		t.Errorf("first swatch = %+v, want blue at 0.75", a.Palette[0])
	}
	if a.Palette[1].Hex != "#ffffff" || a.Palette[1].Share != 0.25 {
		t.Errorf("second swatch = %+v, want white at 0.25", a.Palette[1])
	}
}

func TestSampleCapsLargeImages(t *testing.T) {
	pixels := sample(image.NewGray(image.Rect(0, 0, 4000, 3000)))
	if len(pixels) > maxSamples*2 || len(pixels) < maxSamples/2 {
		t.Errorf("sampled %d pixels, want about %d", len(pixels), maxSamples)
	}
}

func TestAnalyzeJPEG(t *testing.T) {
	f, err := os.Open("../exif/testdata/sample.jpg")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close() //nolint:errcheck // read-only

	a, err := Analyze(f)
	if err != nil {
		t.Fatal(err)
	}
	if len(a.Palette) == 0 || len(a.Palette) > PaletteSize {
		t.Errorf("palette has %d colors, want 1–%d", len(a.Palette), PaletteSize)
	}
	var total float64
	for _, s := range a.Palette {
		total += s.Share
	}
	if total < 0.99 || total > 1.01 {
		t.Errorf("shares sum to %f, want 1", total)
	}
}
