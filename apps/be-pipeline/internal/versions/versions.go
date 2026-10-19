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
	// Quality is the WEBP quality it is encoded at, from 0 to 100.
	Quality int
}

// All are the versions every uploaded photo gets, largest first. The last,
// preview, is a tiny low-quality placeholder of well under a kilobyte, to
// show (blurred) while a real version loads.
var All = []Version{
	{Name: "xlarge", MaxEdge: 2500, Quality: Quality},
	{Name: "large", MaxEdge: 1800, Quality: Quality},
	{Name: "medium", MaxEdge: 1200, Quality: Quality},
	{Name: "small", MaxEdge: 500, Quality: Quality},
	{Name: "xsmall", MaxEdge: 250, Quality: Quality},
	{Name: "preview", MaxEdge: 40, Quality: PreviewQuality},
}

// Quality is the WEBP quality the full versions are encoded at, from 0 to
// 100.
const Quality = 95

// PreviewQuality is the preview's WEBP quality: it is shown blurred, so
// detail would only cost bytes.
const PreviewQuality = 60

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
	return EncodeWEBP(Resize(img, v), v.Quality)
}

// EncodeWEBP encodes an already resized version as a WEBP at quality.
func EncodeWEBP(resized image.Image, quality int) ([]byte, error) {
	var buf bytes.Buffer
	if err := webp.Encode(&buf, resized, webp.Options{Quality: quality, Method: method}); err != nil {
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

// EncodeOnly decodes the JPEG in r and encodes just the versions vs of it.
func EncodeOnly(r io.Reader, vs []Version) ([]Encoded, error) {
	img, err := Decode(r)
	if err != nil {
		return nil, err
	}
	out := make([]Encoded, 0, len(vs))
	for _, v := range vs {
		data, err := Encode(img, v)
		if err != nil {
			return nil, fmt.Errorf("%s version: %w", v.Name, err)
		}
		out = append(out, Encoded{Version: v, Data: data})
	}
	return out, nil
}
