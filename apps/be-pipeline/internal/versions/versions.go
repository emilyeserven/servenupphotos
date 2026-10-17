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
	{Name: "large", MaxEdge: 1800},
	{Name: "medium", MaxEdge: 500},
	{Name: "small", MaxEdge: 250},
}

// Quality is the WEBP quality versions are encoded at, from 0 to 100.
const Quality = 82

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

// Encode scales img down, keeping its proportions, until its longest edge is
// at most v.MaxEdge, and returns it as a WEBP. Smaller photos keep their size.
func Encode(img image.Image, v Version) ([]byte, error) {
	resized := imaging.Fit(img, v.MaxEdge, v.MaxEdge, imaging.Lanczos)
	var buf bytes.Buffer
	if err := webp.Encode(&buf, resized, webp.Options{Quality: Quality, Method: 4}); err != nil {
		return nil, fmt.Errorf("encode %s version: %w", v.Name, err)
	}
	return buf.Bytes(), nil
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
			return nil, err
		}
		out = append(out, Encoded{Version: v, Data: data})
	}
	return out, nil
}
