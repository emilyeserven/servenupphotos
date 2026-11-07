package storage

import (
	"context"
	"errors"
	"io"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// ReplaceOriginal overwrites the original at key, one UploadPhoto wrote, with
// the JPEG in body, such as the same photo with its EXIF edited. The key (and
// the hash in it) stays, so every photo file pointing at it keeps working,
// and the resized versions aren't touched. No backup is kept: the change is
// made in Lightroom first, so a new original can always be exported and
// uploaded again. It returns why the original couldn't be replaced, or ""
// when it was.
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
	err := putObject(ctx, newR2Client(cfg, endpoint), cfg, key, body, size, "image/jpeg", nil)
	var uploadErr *UploadError
	switch {
	case errors.As(err, &uploadErr):
		return "Couldn't upload the edited photo. " + uploadErr.Message
	case err != nil:
		return "Couldn't upload the edited photo."
	}
	return ""
}
