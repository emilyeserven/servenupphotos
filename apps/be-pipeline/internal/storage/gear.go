package storage

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"image/color"
	"io"
	"math"
	"net/http"
	"path"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/versions"
)

// The size of a gear picture's crop, the version the portfolio shows: 200px
// tall, for the Gear & settings filter's info panel, and 4:3.
const (
	GearCropWidth  = 267
	GearCropHeight = 200
)

// gearCropQuality is the WEBP quality a gear picture's crop is saved at.
const gearCropQuality = 90

// gearOriginalExts are the extensions an original gear picture keeps, by its
// kind of picture.
var gearOriginalExts = map[string]string{"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}

// GearOriginal is where an uploaded gear picture went in R2, unchanged, and
// its size upright, in pixels.
type GearOriginal struct {
	Uploaded
	Width  int `json:"width"`
	Height int `json:"height"`
}

// GearCrop is the part of an original gear picture its crop shows, as
// fractions of the original's width and height. It may reach past the
// original's edges, which the crop fills with Fill.
type GearCrop struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
	// Fill is what fills the crop around and behind the picture: "white", or
	// "" to leave it transparent.
	Fill string `json:"fill,omitempty"`
}

// gearFills are the colors a crop's Fill can name.
var gearFills = map[string]color.Color{"": color.Transparent, "white": color.White}

// UploadGearOriginal puts the JPEG, PNG or WEBP picture in body in the bucket
// as it is, at gear/originals/<hash>-<name>.<ext>, returning its key, public
// URL and size. Failures are *UploadError.
func UploadGearOriginal(ctx context.Context, cfg settings.R2, name string, body io.Reader) (GearOriginal, error) {
	return uploadGearOriginal(ctx, cfg, r2Endpoint(cfg), name, body)
}

func uploadGearOriginal(ctx context.Context, cfg settings.R2, endpoint, name string, body io.Reader) (GearOriginal, error) {
	base, err := gearBase(cfg)
	if err != nil {
		return GearOriginal{}, err
	}
	data, err := io.ReadAll(body)
	if err != nil {
		return GearOriginal{}, &UploadError{Message: "Couldn't read the upload."}
	}
	img, err := versions.Decode(bytes.NewReader(data))
	ext := gearOriginalExts[http.DetectContentType(data)]
	if err != nil || ext == "" {
		return GearOriginal{}, &UploadError{Message: "Couldn't read this picture. Use a JPEG, PNG or WEBP.", NotAPhoto: true}
	}
	key := gearKey("gear/originals/", name, data, ext)
	if err := putObject(ctx, newR2Client(cfg, endpoint), cfg, key, bytes.NewReader(data), int64(len(data)), http.DetectContentType(data), nil); err != nil {
		return GearOriginal{}, err
	}
	size := img.Bounds().Size()
	return GearOriginal{Uploaded: Uploaded{Key: key, URL: base + "/" + key}, Width: size.X, Height: size.Y}, nil
}

// CropGearImage cuts crop out of the gear picture at original, a public URL
// of a picture under gear/ in the bucket, scales it to GearCropWidth by
// GearCropHeight, and puts it in the bucket as gear/<hash>-<name>.webp,
// returning its key and public URL. Failures are *UploadError.
func CropGearImage(ctx context.Context, cfg settings.R2, original string, crop GearCrop) (Uploaded, error) {
	return cropGearImage(ctx, cfg, r2Endpoint(cfg), original, crop)
}

func cropGearImage(ctx context.Context, cfg settings.R2, endpoint, original string, crop GearCrop) (Uploaded, error) {
	base, err := gearBase(cfg)
	if err != nil {
		return Uploaded{}, err
	}
	key, ok := strings.CutPrefix(original, base+"/")
	if !ok || !strings.HasPrefix(key, "gear/") || !validGearCrop(crop) {
		return Uploaded{}, &UploadError{Message: "Pick a gear picture in the bucket and a part of it to crop."}
	}
	data, err := encodeGearCrop(ctx, cfg, endpoint, key, crop)
	if err != nil {
		return Uploaded{}, err
	}
	name := strings.TrimPrefix(path.Base(key), strings.SplitN(path.Base(key), "-", 2)[0]+"-")
	out := gearKey("gear/", name, data, ".webp")
	if err := putObject(ctx, newR2Client(cfg, endpoint), cfg, out, bytes.NewReader(data), int64(len(data)), "image/webp", nil); err != nil {
		return Uploaded{}, err
	}
	return Uploaded{Key: out, URL: base + "/" + out}, nil
}

// encodeGearCrop reads the picture at key and returns crop of it as a WEBP.
func encodeGearCrop(ctx context.Context, cfg settings.R2, endpoint, key string, crop GearCrop) ([]byte, error) {
	body, err := getObject(ctx, cfg, endpoint, key)
	if err != nil {
		return nil, &UploadError{Message: err.Error()}
	}
	defer func() { _ = body.Close() }()
	img, err := versions.Decode(body)
	if err != nil {
		return nil, &UploadError{Message: "Couldn't read the original picture.", NotAPhoto: true}
	}
	cropped, ok := versions.CutOut(img, versions.Part{X: crop.X, Y: crop.Y, Width: crop.Width, Height: crop.Height}, GearCropWidth, GearCropHeight, gearFills[crop.Fill])
	if !ok {
		return nil, &UploadError{Message: "The crop doesn't show any of the picture."}
	}
	return versions.EncodeWEBP(cropped, gearCropQuality)
}

// validGearCrop reports whether crop has a size, stays near the picture and
// has a fill it knows.
func validGearCrop(c GearCrop) bool {
	for _, v := range []float64{c.X, c.Y, c.Width, c.Height} {
		if math.IsNaN(v) || math.Abs(v) > 10 {
			return false
		}
	}
	_, fill := gearFills[c.Fill]
	return fill && c.Width > 0 && c.Height > 0
}

// gearBase checks that R2 is set up and returns its public URL.
func gearBase(cfg settings.R2) (string, error) {
	if msg := validateR2(cfg); msg != "" {
		return "", &UploadError{Message: msg, NotConfigured: true}
	}
	base, msg := publicBase(cfg.PublicURL)
	if msg != "" {
		return "", &UploadError{Message: msg, NotConfigured: true}
	}
	return base, nil
}

// gearKey is the object key of a gear picture: <folder><hash>-<name><ext>,
// the hash of its bytes, so a new picture never takes an old one's link.
func gearKey(folder, name string, data []byte, ext string) string {
	sum := sha256.Sum256(data)
	hash := hex.EncodeToString(sum[:])[:12]
	if stem := keyStem(name); stem != "" {
		return folder + hash + "-" + stem + ext
	}
	return folder + hash + ext
}
