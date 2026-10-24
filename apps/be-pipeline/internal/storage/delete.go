package storage

import (
	"context"
	"errors"
	"path"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// DeletePhoto deletes the object key, one UploadPhoto wrote, from the
// configured bucket. Deleting a key that is already gone succeeds. It returns
// why the photo couldn't be deleted, or "" when it was.
func DeletePhoto(ctx context.Context, cfg settings.R2, key string) string {
	return deletePhoto(ctx, cfg, r2Endpoint(cfg), key)
}

func deletePhoto(ctx context.Context, cfg settings.R2, endpoint, key string) string {
	if msg := validateR2(cfg); msg != "" {
		return msg
	}
	// Only photos are ever deleted, so a bad key can't reach anything else in the bucket.
	if !strings.HasPrefix(key, "photos/") || strings.Contains(key, "..") {
		return "Only uploaded photos can be deleted from R2."
	}
	return deleteObject(ctx, cfg, endpoint, key)
}

// DeleteImage deletes the image at key, under any prefix, from the configured
// bucket, for Explore Bucket. Only keys ListImages would list (an image file
// extension) can be deleted. It returns why the image couldn't be deleted, or
// "" when it was.
func DeleteImage(ctx context.Context, cfg settings.R2, key string) string {
	return deleteImage(ctx, cfg, r2Endpoint(cfg), key)
}

func deleteImage(ctx context.Context, cfg settings.R2, endpoint, key string) string {
	if msg := validateR2(cfg); msg != "" {
		return msg
	}
	if !imageExts[strings.ToLower(path.Ext(key))] || strings.Contains(key, "..") {
		return "Only images can be deleted from the bucket."
	}
	return deleteObject(ctx, cfg, endpoint, key)
}

// deleteObject deletes key from the bucket, once the caller has checked it.
func deleteObject(ctx context.Context, cfg settings.R2, endpoint, key string) string {
	_, err := newR2Client(cfg, endpoint).DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(strings.TrimSpace(cfg.Bucket)),
		Key:    aws.String(key),
	})
	if err != nil {
		return describeDeleteError(err)
	}
	return ""
}

// describeDeleteError is describeR2Error for deletes, which need write access.
func describeDeleteError(err error) string {
	var apiErr smithy.APIError
	if errors.As(err, &apiErr) {
		switch apiErr.ErrorCode() {
		case "AccessDenied", "Unauthorized":
			return "This token isn't allowed to delete from that bucket. It needs Object Read & Write permission."
		}
	}
	return describeR2Error(err)
}
