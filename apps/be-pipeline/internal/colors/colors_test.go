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

func shares(a Analysis) map[string]float64 {
	m := map[string]float64{}
	for _, b := range a.Buckets {
		if b.Share > 0 {
			m[b.Name] = b.Share
		}
	}
	return m
}

func TestHueBuckets(t *testing.T) {
	tests := []struct {
		color color.Color
		want  string
	}{
		{color.RGBA{255, 0, 0, 255}, "red"},
		{color.RGBA{255, 128, 0, 255}, "orange"},
		{color.RGBA{255, 255, 0, 255}, "yellow"},
		{color.RGBA{0, 200, 0, 255}, "green"},
		{color.RGBA{0, 255, 255, 255}, "cyan"},
		{color.RGBA{0, 0, 255, 255}, "blue"},
		{color.RGBA{255, 0, 255, 255}, "magenta"},
		{color.RGBA{255, 0, 128, 255}, "rose"},
	}
	for _, tt := range tests {
		t.Run(tt.want, func(t *testing.T) {
			a, err := analyzeImage(solid(tt.color, 20, 20))
			if err != nil {
				t.Fatal(err)
			}
			if got := shares(a); len(got) != 1 || got[tt.want] != 1 {
				t.Errorf("shares = %v, want all %s", got, tt.want)
			}
			if a.Neutrals.Share != 0 {
				t.Errorf("neutral share = %v, want 0", a.Neutrals.Share)
			}
		})
	}
}

func TestNeutralHistogram(t *testing.T) {
	tests := []struct {
		name  string
		color color.Color
		bin   int
	}{
		{"black", color.RGBA{0, 0, 0, 255}, 0},
		{"dark blue", color.RGBA{10, 10, 40, 255}, 0},
		{"mid gray", color.RGBA{119, 119, 119, 255}, 10}, // L* ≈ 50
		{"white", color.RGBA{255, 255, 255, 255}, neutralBins - 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a, err := analyzeImage(solid(tt.color, 20, 20))
			if err != nil {
				t.Fatal(err)
			}
			if got := shares(a); len(got) != 0 {
				t.Errorf("hue shares = %v, want none", got)
			}
			if a.Neutrals.Share != 1 || len(a.Neutrals.Histogram) != neutralBins {
				t.Fatalf("neutrals = %+v, want all %d bins and share 1", a.Neutrals, neutralBins)
			}
			if got := a.Neutrals.Histogram[tt.bin]; got.Share != 1 {
				t.Errorf("bin %d = %+v, want share 1", tt.bin, got)
			}
		})
	}
}

func TestBucketsAreFixed(t *testing.T) {
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
	if len(a.Buckets) != 12 {
		t.Fatalf("got %d buckets, want 12", len(a.Buckets))
	}
	if a.Buckets[0].Name != "red" || a.Buckets[0].Hex != "#ff0000" {
		t.Errorf("first bucket = %+v, want red #ff0000", a.Buckets[0])
	}
	if got := shares(a); got["blue"] != 0.75 || len(got) != 1 {
		t.Errorf("shares = %v, want blue 0.75", got)
	}
	if a.Neutrals.Share != 0.25 {
		t.Errorf("neutral share = %v, want 0.25", a.Neutrals.Share)
	}
}

func TestRaw(t *testing.T) {
	a, err := analyzeImage(solid(color.RGBA{255, 0, 0, 255}, 20, 20))
	if err != nil {
		t.Fatal(err)
	}
	if len(a.Raw.Spaces) != len(spaceDefs) {
		t.Fatalf("got %d spaces, want %d", len(a.Raw.Spaces), len(spaceDefs))
	}
	rgb := a.Raw.Spaces[0]
	if rgb.Name != "rgb" || len(rgb.Channels) != 3 {
		t.Fatalf("first space = %+v, want rgb with 3 channels", rgb)
	}
	if r := rgb.Channels[0]; r.Min != 1 || r.Max != 1 || r.Mean != 1 || r.StdDev != 0 {
		t.Errorf("red channel = %+v, want all 1 with no spread", r)
	}
	for _, s := range a.Raw.Spaces {
		for _, c := range s.Channels {
			if c.Name == "h" {
				t.Errorf("%s includes a hue channel", s.Name)
			}
		}
	}
	h := a.Raw.Histograms
	if len(h.Hue) != 36 || h.Hue[0].Share != 1 || h.Hue[0].Hex != "#ff1500" {
		t.Errorf("hue histogram first bin = %+v (of %d)", h.Hue[0], len(h.Hue))
	}
	if len(h.Lightness) != 20 || len(h.Chroma) != 20 || h.Saturation[19].Share != 1 {
		t.Errorf("histograms = %+v", h)
	}
}

func TestAverage(t *testing.T) {
	a, err := analyzeImage(solid(color.RGBA{255, 0, 0, 255}, 50, 40))
	if err != nil {
		t.Fatal(err)
	}
	if a.Average.Hex != "#ff0000" {
		t.Errorf("average = %s, want #ff0000", a.Average.Hex)
	}
	if a.Samples != 2000 {
		t.Errorf("samples = %d, want 2000", a.Samples)
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
	var total float64
	for _, b := range a.Buckets {
		total += b.Share
	}
	if total < 0.99 || total > 1.01 {
		t.Errorf("shares sum to %f, want 1", total)
	}
}
