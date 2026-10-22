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

// ThumbnailPreview is the Thumbnail's own tiny, low-quality placeholder, cut
// from the same square: what preview is to the other versions, for square
// tiles to show blurred while the Thumbnail loads.
var ThumbnailPreview = Version{Name: "thumbnailpreview", MaxEdge: 40, Quality: PreviewQuality}

// Published are every WEBP an upload puts next to the original: All, then
// the Thumbnail and its ThumbnailPreview.
func Published() []Version {
	return append(All[:len(All):len(All)], Thumbnail, ThumbnailPreview)
}

// IsSquare reports whether v is cut from the thumbnail's square crop: the
// Thumbnail or its ThumbnailPreview.
func IsSquare(v Version) bool {
	return v.Name == Thumbnail.Name || v.Name == ThumbnailPreview.Name
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

// FitCrop is crop fitted to img, or img's CenterCrop when crop is nil.
func FitCrop(img image.Image, crop *Crop) Crop {
	b := img.Bounds()
	if crop == nil {
		return CenterCrop(b.Dx(), b.Dy())
	}
	return crop.Fit(b.Dx(), b.Dy())
}

// Square cuts crop out of img, fitted to it (CenterCrop when crop is nil), and
// scales it to edge×edge pixels.
func Square(img image.Image, crop *Crop, edge int) image.Image {
	c := FitCrop(img, crop)
	area := image.Rect(c.X, c.Y, c.X+c.Size, c.Y+c.Size).Add(img.Bounds().Min)
	return imaging.Resize(imaging.Crop(img, area), edge, edge, imaging.Lanczos)
}

// EncodeUpload decodes the JPEG in r and encodes everything an upload puts in
// R2: every version, then the Thumbnail and ThumbnailPreview cut from crop
// (the CenterCrop when crop is nil).
func EncodeUpload(r io.Reader, crop *Crop) ([]Encoded, error) {
	return EncodeOnly(r, Published(), crop)
}

// FindPublished returns the version, Thumbnail or ThumbnailPreview called name.
func FindPublished(name string) (Version, bool) {
	for _, v := range Published() {
		if v.Name == name {
			return v, true
		}
	}
	return Version{}, false
}

// String is the crop as "x,y,size", how it's saved with the Thumbnail in R2.
func (c Crop) String() string {
	return fmt.Sprintf("%d,%d,%d", c.X, c.Y, c.Size)
}

// ParseCrop reads a crop String wrote. It returns false for anything else,
// including a crop with no size.
func ParseCrop(s string) (Crop, bool) {
	var c Crop
	if n, err := fmt.Sscanf(s, "%d,%d,%d", &c.X, &c.Y, &c.Size); err != nil || n != 3 || c.Size <= 0 {
		return Crop{}, false
	}
	if c.String() != s {
		return Crop{}, false
	}
	return c, true
}
