package versions

import (
	"image"
	"image/color"
	"math"

	"github.com/disintegration/imaging"
)

// Part is a part of a picture, as fractions of its width and height. It may
// reach past the picture's edges.
type Part struct {
	X, Y, Width, Height float64
}

// CutOut scales part of img to width by height pixels over background, which
// fills whatever of the part lies past img's edges and shows through img's
// own transparency. It reports false when the part shows none of img.
func CutOut(img image.Image, part Part, width, height int, background color.Color) (image.Image, bool) {
	b := img.Bounds()
	w, h := float64(b.Dx()), float64(b.Dy())
	x0, y0 := float64(b.Min.X)+part.X*w, float64(b.Min.Y)+part.Y*h
	sx, sy := float64(width)/(part.Width*w), float64(height)/(part.Height*h)
	seen := image.Rect(int(math.Floor(x0)), int(math.Floor(y0)),
		int(math.Ceil(x0+part.Width*w)), int(math.Ceil(y0+part.Height*h))).Intersect(b)
	if seen.Empty() {
		return nil, false
	}
	scaledW := max(1, int(math.Round(float64(seen.Dx())*sx)))
	scaledH := max(1, int(math.Round(float64(seen.Dy())*sy)))
	scaled := imaging.Resize(imaging.Crop(img, seen), scaledW, scaledH, imaging.Lanczos)
	at := image.Pt(int(math.Round((float64(seen.Min.X)-x0)*sx)), int(math.Round((float64(seen.Min.Y)-y0)*sy)))
	return imaging.Overlay(imaging.New(width, height, background), scaled, at, 1), true
}
