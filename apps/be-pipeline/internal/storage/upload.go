package storage

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/url"
	"path"
	"regexp"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// Uploaded is where an uploaded photo ended up.
type Uploaded struct {
	Key string `json:"key"`
	URL string `json:"url"`
}

// UploadError is an upload failure with a reason fit to show the person
// uploading. NotConfigured is set when the R2 settings themselves are
// incomplete, as opposed to Cloudflare rejecting the upload.
type UploadError struct {
	Message       string
	NotConfigured bool
}

func (e *UploadError) Error() string { return e.Message }

// UploadPhoto puts the JPEG in body into the configured bucket and returns its
// key and public URL. body is read twice, once to hash it for the key, so it
// must be seekable. Failures are *UploadError.
func UploadPhoto(ctx context.Context, cfg settings.R2, name string, body io.ReadSeeker) (Uploaded, error) {
	return uploadPhoto(ctx, cfg, r2Endpoint(cfg), name, body)
}

func uploadPhoto(ctx context.Context, cfg settings.R2, endpoint, name string, body io.ReadSeeker) (Uploaded, error) {
	if msg := validateR2(cfg); msg != "" {
		return Uploaded{}, &UploadError{Message: msg, NotConfigured: true}
	}
	base, msg := publicBase(cfg.PublicURL)
	if msg != "" {
		return Uploaded{}, &UploadError{Message: msg, NotConfigured: true}
	}

	key, size, err := photoKey(name, body)
	if err != nil {
		return Uploaded{}, fmt.Errorf("hash photo: %w", err)
	}
	_, err = newR2Client(cfg, endpoint).PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(strings.TrimSpace(cfg.Bucket)),
		Key:           aws.String(key),
		Body:          body,
		ContentLength: aws.Int64(size),
		ContentType:   aws.String("image/jpeg"),
	})
	if err != nil {
		return Uploaded{}, &UploadError{Message: describeUploadError(err)}
	}
	return Uploaded{Key: key, URL: base + "/" + key}, nil
}

// publicBase returns the bucket's public URL setting without a trailing slash,
// or "" and why it can't be used.
func publicBase(raw string) (base, problem string) {
	raw = strings.TrimRight(strings.TrimSpace(raw), "/")
	if raw == "" {
		return "", "Fill in Public URL first, so uploaded photos have a link."
	}
	if problem := publicURLProblem(raw); problem != "" {
		return "", problem
	}
	return raw, ""
}

// publicURLProblem says why raw can't serve photos publicly, or "" if it can.
// The S3 API endpoint is the usual mix-up: it only answers signed requests.
// https://developers.cloudflare.com/r2/buckets/public-buckets/
func publicURLProblem(raw string) string {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" {
		return "The public URL should start with https://, like https://pub-….r2.dev."
	}
	if strings.HasSuffix(strings.ToLower(u.Hostname()), ".r2.cloudflarestorage.com") {
		return "The public URL is the bucket's S3 API endpoint, which needs a signed request. " +
			"Turn on the r2.dev subdomain or a custom domain under the bucket's Public access settings, and use that URL."
	}
	return ""
}

// unsafeKeyChars matches runs of characters left out of object keys, so keys
// are also safe as URL paths.
var unsafeKeyChars = regexp.MustCompile(`[^a-z0-9]+`)

// photoKey names the object photos/<hash>-<name>.jpg, where hash is the start
// of the photo's SHA-256, so uploading the same photo again replaces the same
// object. It also returns the photo's size and leaves body rewound.
func photoKey(name string, body io.ReadSeeker) (string, int64, error) {
	h := sha256.New()
	size, err := io.Copy(h, body)
	if err != nil {
		return "", 0, err
	}
	if _, err := body.Seek(0, io.SeekStart); err != nil {
		return "", 0, err
	}
	hash := hex.EncodeToString(h.Sum(nil))[:12]

	stem := strings.TrimSuffix(path.Base(strings.ReplaceAll(name, `\`, "/")), path.Ext(name))
	stem = strings.Trim(unsafeKeyChars.ReplaceAllString(strings.ToLower(stem), "-"), "-")
	if len(stem) > 60 {
		stem = strings.TrimRight(stem[:60], "-")
	}
	if stem == "" {
		return "photos/" + hash + ".jpg", size, nil
	}
	return "photos/" + hash + "-" + stem + ".jpg", size, nil
}

// describeUploadError is describeR2Error for writes: the token may be able to
// read the bucket, which is all the connection test checks, but not write.
func describeUploadError(err error) string {
	var apiErr smithy.APIError
	if errors.As(err, &apiErr) {
		switch apiErr.ErrorCode() {
		case "AccessDenied", "Unauthorized":
			return "This token isn't allowed to upload to that bucket. It needs Object Read & Write permission."
		}
	}
	return describeR2Error(err)
}
