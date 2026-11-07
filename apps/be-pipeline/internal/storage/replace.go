package storage

import (
	"context"
	"errors"
	"io"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// ExifBackupPrefix starts the key of each original's backup, the copy
// ReplaceOriginal keeps of it as it was before its EXIF was first edited:
// exif-backups/<hash>-<stem>.jpg for photos/<hash>-<stem>.jpg.
const ExifBackupPrefix = "exif-backups/"

// ExifBackupKey is where ReplaceOriginal keeps the original at key as it was
// before its EXIF was first edited.
func ExifBackupKey(key string) string {
	return ExifBackupPrefix + strings.TrimPrefix(key, "photos/")
}

// ReplaceOriginal overwrites the original at key, one UploadPhoto wrote, with
// the JPEG in body, such as the same photo with its EXIF edited. The key (and
// the hash in it) stays, so every photo file pointing at it keeps working,
// and the resized versions aren't touched. Before the first overwrite it
// copies the original to ExifBackupKey, and later overwrites keep that first
// copy. It returns why the original couldn't be replaced, or "" when it was.
func ReplaceOriginal(ctx context.Context, cfg settings.R2, key string, body io.Reader, size int64) string {
	return replaceOriginal(ctx, cfg, r2Endpoint(cfg), key, body, size)
}

func replaceOriginal(ctx context.Context, cfg settings.R2, endpoint, key string, body io.Reader, size int64) string {
	if msg := validateR2(cfg); msg != "" {
		return msg
	}
	if _, ok := ParsePhotoKey(key); !ok {
		return "Only a photo uploaded by the pipeline can have its EXIF edited."
	}
	client := newR2Client(cfg, endpoint)
	if msg := backUpOnce(ctx, client, cfg, key); msg != "" {
		return msg
	}
	if err := putObject(ctx, client, cfg, key, body, size, "image/jpeg", nil); err != nil {
		var uploadErr *UploadError
		if errors.As(err, &uploadErr) {
			return "Couldn't upload the edited photo. " + uploadErr.Message
		}
		return "Couldn't upload the edited photo."
	}
	return ""
}

// backUpOnce copies the original at key to ExifBackupKey unless a backup is
// already there, so the backup is always the photo as it was first uploaded.
func backUpOnce(ctx context.Context, client *s3.Client, cfg settings.R2, key string) string {
	backup := ExifBackupKey(key)
	exists, msg := objectExists(ctx, client, cfg, backup)
	if msg != "" || exists {
		return msg
	}
	missing, msg := copyObject(ctx, client, cfg, key, backup)
	if missing {
		return "The original isn't in the bucket."
	}
	return msg
}

// objectExists reports whether the bucket has an object at key, or why it
// couldn't tell.
func objectExists(ctx context.Context, client *s3.Client, cfg settings.R2, key string) (bool, string) {
	_, err := client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(strings.TrimSpace(cfg.Bucket)),
		Key:    aws.String(key),
	})
	if err == nil {
		return true, ""
	}
	var apiErr smithy.APIError
	if errors.As(err, &apiErr) && (apiErr.ErrorCode() == "NotFound" || apiErr.ErrorCode() == "NoSuchKey") {
		return false, ""
	}
	return false, "Couldn't check for a backup of " + key + ". " + describeR2Error(err)
}
