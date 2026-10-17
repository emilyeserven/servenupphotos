package storage

import (
	"context"
	"errors"
	"io"
	"path"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// GetError is a download failure with a reason fit to show the person asking.
// NotFound is set when the bucket has no such object, and BadKey when the key
// isn't one this pipeline reads.
type GetError struct {
	Message  string
	NotFound bool
	BadKey   bool
}

func (e *GetError) Error() string { return e.Message }

// GetPhoto opens the JPEG at key, one UploadPhoto wrote, in the configured
// bucket. The caller closes the body. Failures are *GetError.
func GetPhoto(ctx context.Context, cfg settings.R2, key string) (io.ReadCloser, error) {
	return getPhoto(ctx, cfg, r2Endpoint(cfg), key)
}

func getPhoto(ctx context.Context, cfg settings.R2, endpoint, key string) (io.ReadCloser, error) {
	if msg := validateR2(cfg); msg != "" {
		return nil, &GetError{Message: msg}
	}
	// Only uploaded JPEG originals are read, so a bad key can't reach anything else in the bucket.
	ext := strings.ToLower(path.Ext(key))
	if !strings.HasPrefix(key, "photos/") || strings.Contains(key, "..") || (ext != ".jpg" && ext != ".jpeg") {
		return nil, &GetError{Message: "Only uploaded JPEG photos can be read from R2.", BadKey: true}
	}
	out, err := newR2Client(cfg, endpoint).GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(strings.TrimSpace(cfg.Bucket)),
		Key:    aws.String(key),
	})
	if err != nil {
		var apiErr smithy.APIError
		if errors.As(err, &apiErr) && apiErr.ErrorCode() == "NoSuchKey" {
			return nil, &GetError{Message: "That photo isn't in the bucket anymore.", NotFound: true}
		}
		return nil, &GetError{Message: describeR2Error(err)}
	}
	return out.Body, nil
}

// OriginalName is the photo file name UploadPhoto's key keeps: the name stem
// with a .jpg extension, photos/<hash>-dsc0001.jpg becoming dsc0001.jpg. A
// key without a stem gives its own base name.
func OriginalName(key string) string {
	if m := photoKeyPattern.FindStringSubmatch(key); m != nil && m[1] != "" {
		return m[1] + ".jpg"
	}
	return path.Base(key)
}
