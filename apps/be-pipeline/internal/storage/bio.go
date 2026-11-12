package storage

import (
	"bytes"
	"context"
	"image"
	"io"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/versions"
)

// The two sizes of a self-portrait on the bio page: the one the page shows,
// and a small one for lists and the pipeline's tiles.
var (
	bioLarge = versions.Version{Name: "large", MaxEdge: 1800, Quality: 90}
	bioSmall = versions.Version{Name: "small", MaxEdge: 500, Quality: 90}
)

// BioPortrait is where an uploaded self-portrait's two WEBP versions went in
// R2, and the large one's size in pixels.
type BioPortrait struct {
	// Image is the public link of the version the bio page shows, at most
	// 1800px on its long edge.
	Image string `json:"image"`
	// Small is the public link of the version at most 500px on its long
	// edge.
	Small  string `json:"small"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
}

// UploadBioPortrait turns the picture in body upright, makes its two WEBP
// versions and puts them in the bucket as bio/<hash>-<name>.webp and
// bio/<hash>-<name>-small.webp. The picture as uploaded isn't kept, so
// nothing from its EXIF (such as where it was taken) ends up in the bucket.
// Failures are *UploadError.
func UploadBioPortrait(ctx context.Context, cfg settings.R2, name string, body io.Reader) (BioPortrait, error) {
	return uploadBioPortrait(ctx, cfg, r2Endpoint(cfg), name, body)
}

func uploadBioPortrait(ctx context.Context, cfg settings.R2, endpoint, name string, body io.Reader) (BioPortrait, error) {
	base, err := gearBase(cfg)
	if err != nil {
		return BioPortrait{}, err
	}
	data, err := io.ReadAll(body)
	if err != nil {
		return BioPortrait{}, &UploadError{Message: "Couldn't read the upload."}
	}
	img, err := versions.Decode(bytes.NewReader(data))
	if err != nil || GearPictureType(data) == "" {
		return BioPortrait{}, &UploadError{Message: "Couldn't read this picture. Use a JPEG, PNG, WEBP, AVIF, GIF, BMP or TIFF.", NotAPhoto: true}
	}
	large := versions.Resize(img, bioLarge)
	client := newR2Client(cfg, endpoint)
	out := BioPortrait{Width: large.Bounds().Dx(), Height: large.Bounds().Dy()}
	for _, v := range []struct {
		resized image.Image
		quality int
		suffix  string
		link    *string
	}{{large, bioLarge.Quality, "", &out.Image}, {versions.Resize(large, bioSmall), bioSmall.Quality, "-small", &out.Small}} {
		encoded, err := versions.EncodeWEBP(v.resized, v.quality)
		if err != nil {
			return BioPortrait{}, &UploadError{Message: "Couldn't make the picture's WEBP versions."}
		}
		key := gearKey("bio/", keyStem(name)+v.suffix, data, ".webp")
		if err := putObject(ctx, client, cfg, key, bytes.NewReader(encoded), int64(len(encoded)), "image/webp", nil); err != nil {
			return BioPortrait{}, err
		}
		*v.link = base + "/" + key
	}
	return out, nil
}
