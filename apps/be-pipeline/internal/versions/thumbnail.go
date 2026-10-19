package versions

import (
	"fmt"
	"image"
	"io"

	"github.com/disintegration/imaging"
)

// Thumbnail is the square crop of a photo the portfolio shows where every
// photo gets the same square tile, such as the Grid. Unlike the other
// versions it is always exactly MaxEdge×MaxEdge: the crop is scaled to fit,
// up or down, whatever its size on the photo.
var Thumbnail = Version{Name: "thumbnail", MaxEdge: 500, Quality: Quality}

// Published are every WEBP an upload puts next to the original: All, then
// the Thumbnail.
func Published() []Version {
	return append(All[:len(All):len(All)], Thumbnail)
}

// Crop is a square on a photo, in pixels of the photo turned upright from its
// EXIF orientation, as browsers show it.
type Crop struct {
	// X and Y are the square's top-left corner.
	X int `json:"x"`
	Y int `json:"y"`
	// Size is the square's width and height.
	Size int `json:"size"`
}

// CenterCrop is the largest square in the middle of a w×h photo, the same
// part `object-fit: cover` shows in a square tile.
func CenterCrop(w, h int) Crop {
	side := min(w, h)
	return Crop{X: (w - side) / 2, Y: (h - side) / 2, Size: side}
}

// Fit moves and shrinks c as little as needed to lie inside a w×h photo. A
// crop with no size becomes the CenterCrop.
func (c Crop) Fit(w, h int) Crop {
	if c.Size <= 0 {
		return CenterCrop(w, h)
	}
	c.Size = min(c.Size, w, h)
	c.X = max(0, min(c.X, w-c.Size))
	c.Y = max(0, min(c.Y, h-c.Size))
	return c
}

// Square cuts crop out of img, fitted to it (CenterCrop when crop is nil), and
// scales it to Thumbnail's size.
func Square(img image.Image, crop *Crop) image.Image {
	b := img.Bounds()
	c := CenterCrop(b.Dx(), b.Dy())
	if crop != nil {
		c = crop.Fit(b.Dx(), b.Dy())
	}
	area := image.Rect(c.X, c.Y, c.X+c.Size, c.Y+c.Size).Add(b.Min)
	return imaging.Resize(imaging.Crop(img, area), Thumbnail.MaxEdge, Thumbnail.MaxEdge, imaging.Lanczos)
}

// EncodeThumbnail makes img's Thumbnail from crop and returns it as a WEBP.
func EncodeThumbnail(img image.Image, crop *Crop) ([]byte, error) {
	return EncodeWEBP(Square(img, crop), Thumbnail.Quality)
}

// EncodeUpload decodes the JPEG in r and encodes everything an upload puts in
// R2: every version, then the Thumbnail cut from crop (the CenterCrop when
// crop is nil).
func EncodeUpload(r io.Reader, crop *Crop) ([]Encoded, error) {
	img, err := Decode(r)
	if err != nil {
		return nil, err
	}
	out := make([]Encoded, 0, len(All)+1)
	for _, v := range All {
		data, err := Encode(img, v)
		if err != nil {
			return nil, fmt.Errorf("%s version: %w", v.Name, err)
		}
		out = append(out, Encoded{Version: v, Data: data})
	}
	data, err := EncodeThumbnail(img, crop)
	if err != nil {
		return nil, fmt.Errorf("%s version: %w", Thumbnail.Name, err)
	}
	return append(out, Encoded{Version: Thumbnail, Data: data}), nil
}
