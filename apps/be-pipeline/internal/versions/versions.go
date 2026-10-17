// Package versions makes the resized WEBP copies of a photo that are
// published alongside the original JPEG.
//
// Photos are decoded with imaging, which turns them upright from their EXIF
// orientation, scaled down to fit each version's longest edge, and encoded
// with gen2brain/webp, libwebp transpiled to Go, so no C library is needed.
package versions

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"
	"io"

	"github.com/disintegration/imaging"
	"github.com/gen2brain/webp"
)

// Version is one resized copy of a photo.
type Version struct {
	// Name is the version's field in the photo data's "images".
	Name string
	// MaxEdge is the most pixels the version's width or height may be.
	MaxEdge int
}

// All are the versions every uploaded photo gets, largest first.
var All = []Version{
	{Name: "xlarge", MaxEdge: 1800},
	{Name: "large", MaxEdge: 1200},
	{Name: "medium", MaxEdge: 500},
	{Name: "small", MaxEdge: 250},
}

// Quality is the WEBP quality versions are encoded at, from 0 to 100.
const Quality = 95

// method is libwebp's effort, from 0 (fastest) to 6 (smallest file for the
// quality); versions are made once, so they get the most.
const method = 6

// Find returns the version called name.
func Find(name string) (Version, bool) {
	for _, v := range All {
		if v.Name == name {
			return v, true
		}
	}
	return Version{}, false
}

// Decode reads a JPEG and turns it upright from its EXIF orientation.
func Decode(r io.Reader) (image.Image, error) {
	img, err := imaging.Decode(r, imaging.AutoOrientation(true))
	if err != nil {
		return nil, fmt.Errorf("decode photo: %w", err)
	}
	return img, nil
}

// Resize scales img down, keeping its proportions, until its longest edge
// is at most v.MaxEdge. Smaller photos keep their size.
func Resize(img image.Image, v Version) image.Image {
	return imaging.Fit(img, v.MaxEdge, v.MaxEdge, imaging.Lanczos)
}

// Encode resizes img for v and returns it as a WEBP.
func Encode(img image.Image, v Version) ([]byte, error) {
	return EncodeWEBP(Resize(img, v))
}

// EncodeWEBP encodes an already resized version as a WEBP.
func EncodeWEBP(resized image.Image) ([]byte, error) {
	var buf bytes.Buffer
	if err := webp.Encode(&buf, resized, webp.Options{Quality: Quality, Method: method}); err != nil {
		return nil, fmt.Errorf("encode WEBP: %w", err)
	}
	return buf.Bytes(), nil
}

// JPEGSize is how many bytes an already resized version would take as a
// JPEG saved at quality, the original photo's own, to show what WEBP saves.
// It is only a comparison: versions are always made from the original's
// pixels, never from a re-saved JPEG.
func JPEGSize(resized image.Image, quality int) (int, error) {
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, resized, &jpeg.Options{Quality: quality}); err != nil {
		return 0, fmt.Errorf("encode JPEG: %w", err)
	}
	return buf.Len(), nil
}

// Encoded is a version's WEBP bytes.
type Encoded struct {
	Version
	Data []byte
}

// EncodeAll decodes the JPEG in r and encodes every version of it.
func EncodeAll(r io.Reader) ([]Encoded, error) {
	img, err := Decode(r)
	if err != nil {
		return nil, err
	}
	out := make([]Encoded, 0, len(All))
	for _, v := range All {
		data, err := Encode(img, v)
		if err != nil {
			return nil, fmt.Errorf("%s version: %w", v.Name, err)
		}
		out = append(out, Encoded{Version: v, Data: data})
	}
	return out, nil
}
