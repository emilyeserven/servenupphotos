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

	// Registers GIF with image.Decode: a gear picture can be any format.
	_ "image/gif"

	// Register AVIF, BMP and TIFF with image.Decode, since a gear picture
	// saved from a store page can be any of them.
	_ "github.com/gen2brain/avif"
	_ "golang.org/x/image/bmp"
	_ "golang.org/x/image/tiff"

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
var gearOriginalExts = map[string]string{
	"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/avif": ".avif",
	"image/gif": ".gif", "image/bmp": ".bmp", "image/tiff": ".tif",
}

// tiffHeads are how a TIFF starts, little- or big-endian.
var tiffHeads = []string{"II*\x00", "MM\x00*"}

// GearPictureType is the kind of picture data starts with, such as
// "image/png", or "" when it isn't a JPEG, PNG, WEBP, AVIF, GIF, BMP or TIFF.
// It needs the first 512 bytes at most.
func GearPictureType(data []byte) string {
	if len(data) >= 12 && string(data[4:8]) == "ftyp" && (string(data[8:12]) == "avif" || string(data[8:12]) == "avis") {
		return "image/avif"
	}
	for _, head := range tiffHeads {
		if bytes.HasPrefix(data, []byte(head)) {
			return "image/tiff"
		}
	}
	if kind := http.DetectContentType(data); gearOriginalExts[kind] != "" {
		return kind
	}
	return ""
}

// GearOriginal is where an uploaded gear picture went in R2, unchanged, its
// size upright, in pixels, and where the camera or lens is in it.
type GearOriginal struct {
	Uploaded
	Width  int `json:"width"`
	Height int `json:"height"`
	// Subject is the box around what isn't plain background, as fractions of
	// the picture's width and height: the product on a store page's white.
	Subject GearBox `json:"subject"`
}

// GearBox is a box in a gear picture, as fractions of its width and height.
type GearBox struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
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

// UploadGearOriginal puts the JPEG, PNG, WEBP, AVIF, GIF, BMP or TIFF picture in body in the bucket
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
	kind := GearPictureType(data)
	if err != nil || kind == "" {
		return GearOriginal{}, &UploadError{Message: "Couldn't read this picture. Use a JPEG, PNG, WEBP, AVIF, GIF, BMP or TIFF.", NotAPhoto: true}
	}
	key := gearKey("gear/originals/", name, data, gearOriginalExts[kind])
	if err := putObject(ctx, newR2Client(cfg, endpoint), cfg, key, bytes.NewReader(data), int64(len(data)), kind, nil); err != nil {
		return GearOriginal{}, err
	}
	size := img.Bounds().Size()
	subject := versions.Subject(img)
	return GearOriginal{
		Uploaded: Uploaded{Key: key, URL: base + "/" + key}, Width: size.X, Height: size.Y,
		Subject: GearBox{X: subject.X, Y: subject.Y, Width: subject.Width, Height: subject.Height},
	}, nil
}

// CropGearImage cuts crop out of the gear picture at original, the public URL
// of a full-size original under gear/originals/ in the bucket (never an
// earlier sized version, so sizing again never loses detail), scales it to GearCropWidth by
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
	if !ok || !strings.HasPrefix(key, "gear/originals/") || !validGearCrop(crop) {
		return Uploaded{}, &UploadError{Message: "Pick a gear picture's full-size original in the bucket and a part of it to size."}
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
		if math.IsNaN(v) || math.Abs(v) > 100 {
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
