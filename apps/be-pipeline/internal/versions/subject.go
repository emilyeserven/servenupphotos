package versions

import (
	"image"
	"image/color"

	"github.com/disintegration/imaging"
)

// subjectScanEdge is the longest edge a picture is shrunk to before its
// subject is looked for: enough to find its edges to within a percent or so.
const subjectScanEdge = 400

// subjectTolerance is how far, out of 255 in any channel, a pixel's color can
// be from the background's and still count as background, allowing for JPEG
// noise and a faint shadow on a store page's white.
const subjectTolerance = 24

// Subject finds the part of img that isn't its plain background: the box
// around every pixel that's neither transparent nor the color of its corners,
// as fractions of img's width and height. A product photo from a store page,
// on white or on nothing, gives the box around the product. A picture with no
// plain background gives the whole picture.
func Subject(img image.Image) Part {
	small := imaging.Fit(img, subjectScanEdge, subjectScanEdge, imaging.Box)
	b := small.Bounds()
	bg := cornerColor(small)
	box := image.Rectangle{}
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			if !isBackground(small.NRGBAAt(x, y), bg) {
				box = box.Union(image.Rect(x, y, x+1, y+1))
			}
		}
	}
	if box.Empty() {
		return Part{Width: 1, Height: 1}
	}
	w, h := float64(b.Dx()), float64(b.Dy())
	return Part{
		X:      float64(box.Min.X-b.Min.X) / w,
		Y:      float64(box.Min.Y-b.Min.Y) / h,
		Width:  float64(box.Dx()) / w,
		Height: float64(box.Dy()) / h,
	}
}

// cornerColor is the average of img's four corner pixels, taken as its
// background.
func cornerColor(img *image.NRGBA) color.NRGBA {
	b := img.Bounds()
	corners := []image.Point{b.Min, {b.Max.X - 1, b.Min.Y}, {b.Min.X, b.Max.Y - 1}, b.Max.Sub(image.Pt(1, 1))}
	var r, g, bl, a int
	for _, p := range corners {
		c := img.NRGBAAt(p.X, p.Y)
		r, g, bl, a = r+int(c.R), g+int(c.G), bl+int(c.B), a+int(c.A)
	}
	return color.NRGBA{R: uint8(r / 4), G: uint8(g / 4), B: uint8(bl / 4), A: uint8(a / 4)} //nolint:gosec // averages of four bytes
}

// isBackground reports whether c is see-through, or close to bg when bg is
// itself solid.
func isBackground(c, bg color.NRGBA) bool {
	if c.A < 16 {
		return true
	}
	return bg.A >= 240 && near(c.R, bg.R) && near(c.G, bg.G) && near(c.B, bg.B)
}

func near(a, b uint8) bool {
	d := int(a) - int(b)
	return d <= subjectTolerance && d >= -subjectTolerance
}
