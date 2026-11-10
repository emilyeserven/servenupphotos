package versions

import (
	"image"
	"image/color"
	"image/draw"
)

// The shapes a Face can have.
const (
	// ShapeBox pixelates the whole box.
	ShapeBox = "box"
	// ShapeCircle pixelates the circle, or oval, that fits in the box.
	ShapeCircle = "circle"
)

// The ways a circle's edge can be pixelated.
const (
	// EdgeInside pixelates only the pixels inside the circle, so its edge
	// stays round and the box's corners keep the photo.
	EdgeInside = "inside"
	// EdgeBlocks pixelates every block the circle touches whole, so the edge
	// is a staircase of blocks whose corners reach past the circle.
	EdgeBlocks = "blocks"
)

// shapeValid reports why f's shape or edge isn't one there is, or "".
func (f Face) shapeValid() string {
	switch {
	case f.Shape != "" && f.Shape != ShapeBox && f.Shape != ShapeCircle:
		return `each face's shape is "box" or "circle"`
	case f.Edge != "" && f.Edge != EdgeInside && f.Edge != EdgeBlocks:
		return `each circle's edge is "inside" or "blocks"`
	}
	return ""
}

func (f Face) isCircle() bool { return f.Shape == ShapeCircle }

// shapeSuffix is what a circle adds to its face in a Faces String, or ""
// for a box.
func (f Face) shapeSuffix() string {
	switch {
	case !f.isCircle():
		return ""
	case f.Edge == EdgeBlocks:
		return ",circle-blocks"
	default:
		return ",circle"
	}
}

// keepSuffix is ",keep" for an area kept as it is, or "".
func (f Face) keepSuffix() string {
	if f.Keep {
		return ",keep"
	}
	return ""
}

// setFlags sets f's shape, edge and Keep from the fields shapeSuffix and
// keepSuffix wrote, in that order, reporting whether they were those.
func (f *Face) setFlags(fields []string) bool {
	if len(fields) > 0 && fields[len(fields)-1] == "keep" {
		f.Keep = true
		fields = fields[:len(fields)-1]
	}
	switch len(fields) {
	case 0:
		return true
	case 1:
		return f.setShape(fields[0])
	}
	return false
}

// setShape sets f's shape and edge from what shapeSuffix wrote, without its
// comma, reporting whether it was one.
func (f *Face) setShape(s string) bool {
	switch s {
	case "circle":
		f.Shape = ShapeCircle
	case "circle-blocks":
		f.Shape, f.Edge = ShapeCircle, EdgeBlocks
	default:
		return false
	}
	return true
}

// ellipse is the circle that fits in f's box: its center and radii.
func (f Face) ellipse() (cx, cy, rx, ry float64) {
	rx, ry = float64(f.Width)/2, float64(f.Height)/2
	return float64(f.X) + rx, float64(f.Y) + ry, rx, ry
}

// inEllipse reports whether the point x, y is inside f's circle.
func (f Face) inEllipse(x, y float64) bool {
	cx, cy, rx, ry := f.ellipse()
	dx, dy := (x-cx)/rx, (y-cy)/ry
	return dx*dx+dy*dy <= 1
}

// inside reports whether the pixel at x, y has its middle inside f's circle.
func (f Face) inside(x, y int) bool {
	return f.inEllipse(float64(x)+0.5, float64(y)+0.5)
}

// touches reports whether any of block lies inside f's circle: whether the
// block's point nearest the circle's center does.
func (f Face) touches(block image.Rectangle) bool {
	cx, cy, _, _ := f.ellipse()
	nx := min(max(cx, float64(block.Min.X)), float64(block.Max.X))
	ny := min(max(cy, float64(block.Min.Y)), float64(block.Max.Y))
	return f.inEllipse(nx, ny)
}

// fillInside fills the pixels of block on img that inside reports, with
// their own average color, leaving the rest of the block as it is.
func fillInside(img *image.NRGBA, block image.Rectangle, inside func(x, y int) bool) {
	var sum [4]int
	n := 0
	eachInside(block, inside, func(x, y int) {
		c := img.NRGBAAt(x, y)
		sum[0], sum[1], sum[2], sum[3] = sum[0]+int(c.R), sum[1]+int(c.G), sum[2]+int(c.B), sum[3]+int(c.A)
		n++
	})
	if n == 0 {
		return
	}
	avg := color.NRGBA{R: channel(sum[0], n), G: channel(sum[1], n), B: channel(sum[2], n), A: channel(sum[3], n)}
	eachInside(block, inside, func(x, y int) { img.SetNRGBA(x, y, avg) })
}

// eachInside calls do with every pixel of r that inside reports.
func eachInside(r image.Rectangle, inside func(x, y int) bool, do func(x, y int)) {
	for y := r.Min.Y; y < r.Max.Y; y++ {
		for x := r.Min.X; x < r.Max.X; x++ {
			if inside(x, y) {
				do(x, y)
			}
		}
	}
}

// restore puts the pixels of f's area (its box, or its circle) on out back to
// how they are on the photo img, undoing any pixelation there.
func restore(out *image.NRGBA, img image.Image, f Face) {
	box := image.Rect(f.X, f.Y, f.X+f.Width, f.Y+f.Height).Intersect(out.Bounds())
	offset := img.Bounds().Min
	if !f.isCircle() {
		draw.Draw(out, box, img, box.Min.Add(offset), draw.Src)
		return
	}
	eachInside(box, f.inside, func(x, y int) {
		out.Set(x, y, img.At(x+offset.X, y+offset.Y))
	})
}
