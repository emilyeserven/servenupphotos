package storage

import (
	"bytes"
	"context"
	"errors"
	"io"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/versions"
)

// RegenerateVersions downloads the original JPEG at key, one UploadPhoto
// wrote, makes the versions vs of it again and uploads them over whatever is
// already at their keys, so a missing version is made for the first time and
// an existing one is replaced. It returns where each version ended up, by
// version name. Failures are *UploadError, with NotFound set when key isn't a
// photo in the bucket.
func RegenerateVersions(ctx context.Context, cfg settings.R2, key string, vs []versions.Version) (map[string]Uploaded, error) {
	return regenerateVersions(ctx, cfg, r2Endpoint(cfg), key, vs, versions.EncodeOnly)
}

// encodeOnlyFunc makes some of a photo's versions; versions.EncodeOnly in production.
type encodeOnlyFunc func(photo io.Reader, vs []versions.Version) ([]versions.Encoded, error)

func regenerateVersions(ctx context.Context, cfg settings.R2, endpoint, key string, vs []versions.Version, encode encodeOnlyFunc) (map[string]Uploaded, error) {
	if msg := validateR2(cfg); msg != "" {
		return nil, &UploadError{Message: msg, NotConfigured: true}
	}
	base, msg := publicBase(cfg.PublicURL)
	if msg != "" {
		return nil, &UploadError{Message: msg, NotConfigured: true}
	}
	// Only originals UploadPhoto wrote have versions, and checking keeps the
	// writes below to the photos/ prefix.
	if !photoKeyPattern.MatchString(key) {
		return nil, &UploadError{Message: "Only photos uploaded by the pipeline have resized versions.", NotFound: true}
	}

	client := newR2Client(cfg, endpoint)
	obj, err := client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(strings.TrimSpace(cfg.Bucket)),
		Key:    aws.String(key),
	})
	if err != nil {
		var noKey *types.NoSuchKey
		if errors.As(err, &noKey) {
			return nil, &UploadError{Message: "That photo isn't in the bucket anymore.", NotFound: true}
		}
		return nil, &UploadError{
			Message:    "Couldn't download the original photo. " + describeR2Error(err),
			Cloudflare: cloudflareResponse(err),
		}
	}
	defer obj.Body.Close() //nolint:errcheck // read-only

	encoded, err := encode(obj.Body, vs)
	if err != nil {
		return nil, &UploadError{Message: "Couldn't read the original JPEG to make its resized versions.", NotAPhoto: true}
	}
	out := map[string]Uploaded{}
	for _, v := range encoded {
		vkey := VersionKey(key, v.Name)
		if err := putObject(ctx, client, cfg, vkey, bytes.NewReader(v.Data), int64(len(v.Data)), "image/webp"); err != nil {
			return nil, err
		}
		out[v.Name] = Uploaded{Key: vkey, URL: base + "/" + vkey}
	}
	return out, nil
}
