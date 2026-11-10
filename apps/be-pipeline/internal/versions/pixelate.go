package versions

import (
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"strconv"
	"strings"
)

// Face is a box on a photo to hide by pixelating it, in pixels of the photo
// turned upright from its EXIF orientation, as browsers show it.
type Face struct {
	// X and Y are the box's top-left corner.
	X int `json:"x"`
	Y int `json:"y"`
	// Width and Height are the box's size.
	Width  int `json:"width"`
	Height int `json:"height"`
	// Blocks is the pixelation's density: how many blocks fit across the
	// box's longer side. Fewer blocks hide more.
	Blocks int `json:"blocks"`
	// Shape is ShapeCircle to pixelate only the circle (an oval when the
	// box isn't square) that fits in the box; the whole box when empty or
	// ShapeBox.
	Shape string `json:"shape,omitempty"`
	// Edge is how a circle's or a turned box's edge is pixelated: EdgeBlocks
	// pixelates every block the area touches whole, so block corners reach
	// past it; empty or EdgeInside pixelates only the pixels inside it.
	Edge string `json:"edge,omitempty"`
	// Rotation turns the box or circle clockwise about its middle, in whole
	// degrees from -180 to 180; X, Y, Width and Height are the box before
	// it's turned. Its blocks stay square with the photo.
	Rotation int `json:"rotation,omitempty"`
	// Keep marks an area to leave as the photo has it, such as hair over
	// a pixelated face: it undoes every face's pixelation inside its box or
	// circle. Its Blocks is unused.
	Keep bool `json:"keep,omitempty"`
}

// Faces are the boxes pixelated on one photo.
type Faces []Face

// MinBlocks and MaxBlocks are the fewest and most blocks a Face may have
// across its longer side; DefaultBlocks is what a found face starts with.
const (
	MinBlocks     = 3
	MaxBlocks     = 40
	DefaultBlocks = 8
)

// MaxFaces is the most boxes one photo may have, so their String fits in an
// R2 object's metadata (2 KB in all).
const MaxFaces = 30

// Valid reports why f can't be pixelated, or "" when it can.
func (f Face) Valid() string {
	switch {
	case f.Width <= 0 || f.Height <= 0:
		return "each face needs a width and a height"
	case f.X < 0 || f.Y < 0:
		return "each face needs a corner inside the photo"
	case f.Blocks < MinBlocks || f.Blocks > MaxBlocks:
		return fmt.Sprintf("each face needs %d to %d blocks", MinBlocks, MaxBlocks)
	}
	return f.shapeValid()
}

// Valid reports why fs can't be pixelated, or "" when they can.
func (fs Faces) Valid() string {
	if len(fs) > MaxFaces {
		return fmt.Sprintf("a photo can have at most %d faces", MaxFaces)
	}
	for _, f := range fs {
		if msg := f.Valid(); msg != "" {
			return msg
		}
	}
	return ""
}

// blockSide is how many pixels each block of f covers, so Blocks of them
// span its longer side.
func (f Face) blockSide() int {
	longer := max(f.Width, f.Height)
	blocks := max(1, f.Blocks)
	return max(1, (longer+blocks-1)/blocks)
}

// Pixelate returns img with every face in fs turned into blocks, each the
// average color of the pixels under it, the way a mosaic hides a face on TV.
// It is applied to the full-size photo before any version is cut, so every
// version, however small, only ever has the blocks to show. img itself is
// left alone; with no faces it is returned as is.
func Pixelate(img image.Image, fs Faces) image.Image {
	if len(fs) == 0 {
		return img
	}
	b := img.Bounds()
	out := image.NewNRGBA(image.Rect(0, 0, b.Dx(), b.Dy()))
	draw.Draw(out, out.Bounds(), img, b.Min, draw.Src)
	for _, f := range fs {
		if !f.Keep {
			pixelateFace(out, f)
		}
	}
	for _, f := range fs {
		if f.Keep {
			restore(out, img, f)
		}
	}
	return out
}

// pixelateFace fills each block of f on img, clipped to img, with its average:
// the whole block in a box, and in a circle or a turned box the part inside
// it, or every block it touches with EdgeBlocks. The blocks start at the top
// left of the area's bounds, the box itself when it isn't turned.
func pixelateFace(img *image.NRGBA, f Face) {
	box := f.bounds().Intersect(img.Bounds())
	side := f.blockSide()
	for y := box.Min.Y; y < box.Max.Y; y += side {
		for x := box.Min.X; x < box.Max.X; x += side {
			pixelateBlock(img, f, image.Rect(x, y, x+side, y+side).Intersect(box))
		}
	}
}

// pixelateBlock fills the part of block that f covers with its average.
func pixelateBlock(img *image.NRGBA, f Face, block image.Rectangle) {
	switch {
	case !f.isCircle() && f.Rotation == 0:
		fillBlock(img, block)
	case f.Edge == EdgeBlocks:
		if f.touches(block) {
			fillBlock(img, block)
		}
	default:
		fillInside(img, block, f.inside)
	}
}

// fillBlock fills block on img with its average color.
func fillBlock(img *image.NRGBA, block image.Rectangle) {
	draw.Draw(img, block, image.NewUniform(average(img, block)), image.Point{}, draw.Src)
}

// average is the mean color of the pixels of img inside r.
func average(img *image.NRGBA, r image.Rectangle) color.NRGBA {
	var sum [4]int
	for y := r.Min.Y; y < r.Max.Y; y++ {
		row := img.Pix[img.PixOffset(r.Min.X, y):img.PixOffset(r.Max.X, y)]
		for i := 0; i < len(row); i += 4 {
			for c := range sum {
				sum[c] += int(row[i+c])
			}
		}
	}
	n := max(1, r.Dx()*r.Dy())
	return color.NRGBA{R: channel(sum[0], n), G: channel(sum[1], n), B: channel(sum[2], n), A: channel(sum[3], n)}
}

// channel is the mean of n channel values adding up to sum, which is always
// from 0 to 255.
func channel(sum, n int) uint8 {
	return uint8(min(255, max(0, sum/n))) //nolint:gosec // clamped to 0–255 just above
}

// String is fs as "x,y,width,height,blocks" for each face, with ",circle" or
// ",circle-blocks" after a circle's (",box-blocks" after a box pixelated in
// whole blocks), ",rot<degrees>" after a turned one's and ",keep" after an
// area kept as it is,
// joined by ";": how it's saved with each version in R2 so remaking a version
// keeps them.
func (fs Faces) String() string {
	parts := make([]string, len(fs))
	for i, f := range fs {
		parts[i] = fmt.Sprintf("%d,%d,%d,%d,%d", f.X, f.Y, f.Width, f.Height, f.Blocks) + f.shapeSuffix() + f.rotationSuffix() + f.keepSuffix()
	}
	return strings.Join(parts, ";")
}

// ParseFaces reads faces String wrote. It returns false for anything else.
// An empty string is no faces.
func ParseFaces(s string) (Faces, bool) {
	if s == "" {
		return nil, true
	}
	parts := strings.Split(s, ";")
	fs := make(Faces, 0, len(parts))
	for _, part := range parts {
		f, ok := parseFace(part)
		if !ok {
			return nil, false
		}
		fs = append(fs, f)
	}
	if fs.String() != s {
		return nil, false
	}
	return fs, true
}

// parseFace reads one face of a Faces String.
func parseFace(s string) (Face, bool) {
	fields := strings.Split(s, ",")
	if len(fields) < 5 || len(fields) > 8 {
		return Face{}, false
	}
	var n [5]int
	for i := range n {
		v, err := strconv.Atoi(fields[i])
		if err != nil {
			return Face{}, false
		}
		n[i] = v
	}
	f := Face{X: n[0], Y: n[1], Width: n[2], Height: n[3], Blocks: n[4]}
	if !f.setFlags(fields[5:]) {
		return Face{}, false
	}
	return f, f.Valid() == ""
}
