package storage

import (
	"context"
	"errors"
	"io"
	"slices"
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
// an existing one is replaced. A versions.Thumbnail is cut from crop when it
// isn't nil, and otherwise from the crop saved with the one already there, or
// the middle of the photo when there is none. It returns where each version
// ended up, by version name. Failures are *UploadError, with NotFound set when
// key isn't a photo in the bucket.
func RegenerateVersions(ctx context.Context, cfg settings.R2, key string, vs []versions.Version, crop *versions.Crop) (map[string]Uploaded, error) {
	return regenerateVersions(ctx, cfg, r2Endpoint(cfg), key, vs, crop, versions.EncodeOnly)
}

// ThumbnailCrop is the crop saved with the versions.Thumbnail of the original
// at key, the square picked for it on the Photo page, or nil when there is no
// thumbnail yet or it has no crop saved, so it was cut from the middle.
// Failures are *UploadError.
func ThumbnailCrop(ctx context.Context, cfg settings.R2, key string) (*versions.Crop, error) {
	return savedThumbnailCrop(ctx, cfg, r2Endpoint(cfg), key)
}

func savedThumbnailCrop(ctx context.Context, cfg settings.R2, endpoint, key string) (*versions.Crop, error) {
	if msg := validateR2(cfg); msg != "" {
		return nil, &UploadError{Message: msg, NotConfigured: true}
	}
	if !photoKeyPattern.MatchString(key) {
		return nil, &UploadError{Message: "Only photos uploaded by the pipeline have a Square Thumbnail.", NotFound: true}
	}
	return thumbnailCrop(ctx, newR2Client(cfg, endpoint), cfg, key, []versions.Version{versions.Thumbnail})
}

// encodeOnlyFunc makes some of a photo's versions, a thumbnail among them cut
// from crop; versions.EncodeOnly in production.
type encodeOnlyFunc func(photo io.Reader, vs []versions.Version, crop *versions.Crop) ([]versions.Encoded, error)

func regenerateVersions(ctx context.Context, cfg settings.R2, endpoint, key string, vs []versions.Version, crop *versions.Crop, encode encodeOnlyFunc) (map[string]Uploaded, error) {
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
	if crop == nil {
		saved, err := thumbnailCrop(ctx, client, cfg, key, vs)
		if err != nil {
			return nil, err
		}
		crop = saved
	}
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

	encoded, err := encode(obj.Body, vs, crop)
	if err != nil {
		return nil, &UploadError{Message: "Couldn't read the original JPEG to make its resized versions.", NotAPhoto: true}
	}
	out := map[string]Uploaded{}
	for _, v := range encoded {
		vkey := VersionKey(key, v.Name)
		if err := putVersion(ctx, client, cfg, vkey, v); err != nil {
			return nil, err
		}
		out[v.Name] = Uploaded{Key: vkey, URL: base + "/" + vkey}
	}
	return out, nil
}

// thumbnailCrop is the crop saved with the thumbnail of the original at key,
// when vs remakes it and it has one, so a remake keeps the square picked on the
// Photo page. It is nil, for the middle of the photo, when vs doesn't include
// the thumbnail, there is no thumbnail yet, or it has no crop saved.
func thumbnailCrop(ctx context.Context, client *s3.Client, cfg settings.R2, key string, vs []versions.Version) (*versions.Crop, error) {
	if !slices.ContainsFunc(vs, func(v versions.Version) bool { return v.Name == versions.Thumbnail.Name }) {
		return nil, nil
	}
	head, err := client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(strings.TrimSpace(cfg.Bucket)),
		Key:    aws.String(VersionKey(key, versions.Thumbnail.Name)),
	})
	if err != nil {
		var notFound *types.NotFound
		if errors.As(err, &notFound) {
			return nil, nil
		}
		return nil, &UploadError{
			Message:    "Couldn't read the Square Thumbnail's crop. " + describeR2Error(err),
			Cloudflare: cloudflareResponse(err),
		}
	}
	crop, ok := versions.ParseCrop(head.Metadata[cropMetadata])
	if !ok {
		return nil, nil
	}
	return &crop, nil
}
