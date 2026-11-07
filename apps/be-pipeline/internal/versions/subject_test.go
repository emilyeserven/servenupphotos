package versions

import (
	"image"
	"image/color"
	"math"
	"testing"
)

func TestSubject(t *testing.T) {
	near := func(a, b float64) bool { return math.Abs(a-b) < 0.02 }
	tests := []struct {
		name string
		bg   color.NRGBA
		want Part
	}{
		{"on white", color.NRGBA{R: 255, G: 255, B: 255, A: 255}, Part{X: 0.25, Y: 0.5, Width: 0.5, Height: 0.25}},
		{"on nothing", color.NRGBA{}, Part{X: 0.25, Y: 0.5, Width: 0.5, Height: 0.25}},
	}
	for _, tt := range tests {
		img := image.NewNRGBA(image.Rect(0, 0, 800, 400))
		for y := range 400 {
			for x := range 800 {
				img.SetNRGBA(x, y, tt.bg)
			}
		}
		// A dark camera body, with a faint shadow that should count as background.
		for y := 200; y < 300; y++ {
			for x := 200; x < 600; x++ {
				img.SetNRGBA(x, y, color.NRGBA{R: 30, G: 30, B: 30, A: 255})
			}
		}
		if tt.bg.A > 0 {
			for x := 150; x < 650; x++ {
				img.SetNRGBA(x, 320, color.NRGBA{R: 245, G: 245, B: 245, A: 255})
			}
		}
		got := Subject(img)
		if !near(got.X, tt.want.X) || !near(got.Y, tt.want.Y) || !near(got.Width, tt.want.Width) || !near(got.Height, tt.want.Height) {
			t.Errorf("%s: Subject() = %+v, want %+v", tt.name, got, tt.want)
		}
	}
	if got := Subject(image.NewNRGBA(image.Rect(0, 0, 10, 10))); got != (Part{Width: 1, Height: 1}) {
		t.Errorf("empty picture: Subject() = %+v, want the whole", got)
	}
}
