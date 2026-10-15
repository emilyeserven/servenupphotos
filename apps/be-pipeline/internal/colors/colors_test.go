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

func TestBuckets(t *testing.T) {
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
		{color.RGBA{10, 10, 30, 255}, "black"},
		{color.RGBA{128, 128, 128, 255}, "gray"},
		{color.RGBA{250, 248, 245, 255}, "white"},
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
	if len(a.Buckets) != len(bucketNames) {
		t.Fatalf("got %d buckets, want all %d", len(a.Buckets), len(bucketNames))
	}
	if a.Buckets[0].Name != "red" || a.Buckets[0].Hex != "#ff0000" {
		t.Errorf("first bucket = %+v, want red #ff0000", a.Buckets[0])
	}
	got := shares(a)
	if got["blue"] != 0.75 || got["white"] != 0.25 || len(got) != 2 {
		t.Errorf("shares = %v, want blue 0.75 and white 0.25", got)
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
