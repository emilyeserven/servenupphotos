package storage

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/versions"
)

// GearImage is the size a camera's or lens's own picture is kept at: big
// enough for the Gear & settings filter's info panel on a sharp screen.
var GearImage = versions.Version{Name: "gear", MaxEdge: 800, Quality: 90}

// UploadGearImage resizes the JPEG, PNG or WEBP picture in body to fit
// GearImage, keeping any transparency, and puts it in the bucket as
// gear/<hash>-<name>.webp, returning its key and public URL. Uploading the
// same picture again just replaces it. Failures are *UploadError.
func UploadGearImage(ctx context.Context, cfg settings.R2, name string, body io.Reader) (Uploaded, error) {
	return uploadGearImage(ctx, cfg, r2Endpoint(cfg), name, body, encodeGearImage)
}

// gearEncodeFunc turns a picture into the WEBP kept in the bucket;
// encodeGearImage in production.
type gearEncodeFunc func(picture io.Reader) ([]byte, error)

// encodeGearImage decodes the picture and encodes it as a GearImage WEBP.
func encodeGearImage(picture io.Reader) ([]byte, error) {
	img, err := versions.Decode(picture)
	if err != nil {
		return nil, err
	}
	return versions.Encode(img, GearImage)
}

func uploadGearImage(ctx context.Context, cfg settings.R2, endpoint, name string, body io.Reader, encode gearEncodeFunc) (Uploaded, error) {
	if msg := validateR2(cfg); msg != "" {
		return Uploaded{}, &UploadError{Message: msg, NotConfigured: true}
	}
	base, msg := publicBase(cfg.PublicURL)
	if msg != "" {
		return Uploaded{}, &UploadError{Message: msg, NotConfigured: true}
	}
	data, err := encode(body)
	if err != nil {
		return Uploaded{}, &UploadError{Message: "Couldn't read this picture. Use a JPEG, PNG or WEBP.", NotAPhoto: true}
	}
	key := gearKey(name, data)
	client := newR2Client(cfg, endpoint)
	if err := putObject(ctx, client, cfg, key, bytes.NewReader(data), int64(len(data)), "image/webp", nil); err != nil {
		return Uploaded{}, err
	}
	return Uploaded{Key: key, URL: base + "/" + key}, nil
}

// gearKey is the object key of a gear picture: gear/<hash>-<name>.webp, the
// hash of its WEBP bytes, so a new picture never takes an old one's link.
func gearKey(name string, data []byte) string {
	sum := sha256.Sum256(data)
	hash := hex.EncodeToString(sum[:])[:12]
	if stem := keyStem(name); stem != "" {
		return "gear/" + hash + "-" + stem + ".webp"
	}
	return "gear/" + hash + ".webp"
}
