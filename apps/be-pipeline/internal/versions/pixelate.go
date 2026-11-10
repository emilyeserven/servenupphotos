package versions

import (
	"fmt"
	"image"
	"image/color"
	"image/draw"
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
const MaxFaces = 40

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
	return ""
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
		pixelateFace(out, f)
	}
	return out
}

// pixelateFace fills each block of f on img, clipped to img, with its average.
func pixelateFace(img *image.NRGBA, f Face) {
	box := image.Rect(f.X, f.Y, f.X+f.Width, f.Y+f.Height).Intersect(img.Bounds())
	side := f.blockSide()
	for y := box.Min.Y; y < box.Max.Y; y += side {
		for x := box.Min.X; x < box.Max.X; x += side {
			block := image.Rect(x, y, x+side, y+side).Intersect(box)
			draw.Draw(img, block, image.NewUniform(average(img, block)), image.Point{}, draw.Src)
		}
	}
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

// String is fs as "x,y,width,height,blocks" for each face, joined by ";",
// how it's saved with each version in R2 so remaking a version keeps them.
func (fs Faces) String() string {
	parts := make([]string, len(fs))
	for i, f := range fs {
		parts[i] = fmt.Sprintf("%d,%d,%d,%d,%d", f.X, f.Y, f.Width, f.Height, f.Blocks)
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
		var f Face
		if n, err := fmt.Sscanf(part, "%d,%d,%d,%d,%d", &f.X, &f.Y, &f.Width, &f.Height, &f.Blocks); err != nil || n != 5 || f.Valid() != "" {
			return nil, false
		}
		fs = append(fs, f)
	}
	if fs.String() != s {
		return nil, false
	}
	return fs, true
}
