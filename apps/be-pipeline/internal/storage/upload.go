package storage

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/url"
	"path"
	"regexp"
	"sort"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/versions"
)

// Uploaded is where an uploaded photo ended up.
type Uploaded struct {
	Key string `json:"key"`
	URL string `json:"url"`
}

// UploadResult is where an uploaded photo and its resized versions ended up.
type UploadResult struct {
	Uploaded
	// Versions are the photo's WEBP copies, by version name.
	Versions map[string]Uploaded `json:"versions"`
}

// UploadError is an upload failure with a reason fit to show the person
// uploading. NotConfigured is set when the R2 settings themselves are
// incomplete, as opposed to Cloudflare rejecting the upload.
type UploadError struct {
	Message       string
	NotConfigured bool
	// NotAPhoto is set when the JPEG couldn't be read to make its versions.
	NotAPhoto bool
	// NotFound is set when regenerating the versions of a photo that isn't
	// in the bucket.
	NotFound bool
	// SameName lists the other photos already in the bucket under the name
	// being uploaded, newest first, when that is why the upload stopped.
	SameName []BucketImage
	// Cloudflare is what Cloudflare answered, when it rejected a request.
	Cloudflare *CloudflareResponse
}

func (e *UploadError) Error() string { return e.Message }

// UploadOptions changes how UploadPhoto treats the bucket's existing photos.
type UploadOptions struct {
	// KeepSameName uploads the photo even when the bucket already has a
	// different photo under the same name.
	KeepSameName bool
}

// UploadPhoto puts the JPEG in body into the configured bucket, along with
// each of versions.All as a WEBP, and returns their keys and public URLs. body
// is read three times, to hash it for the key, to make the versions and to
// upload it, so it must be seekable. Unless opts.KeepSameName is set, it first looks for other
// photos uploaded under the same name and stops with their list in
// UploadError.SameName, since Photos in Flight matches photos by name. Failures
// are *UploadError.
func UploadPhoto(ctx context.Context, cfg settings.R2, name string, body io.ReadSeeker, opts UploadOptions) (UploadResult, error) {
	return uploadPhoto(ctx, cfg, r2Endpoint(cfg), name, body, opts, versions.EncodeAll)
}

// encodeFunc makes a photo's versions; versions.EncodeAll in production.
type encodeFunc func(photo io.Reader) ([]versions.Encoded, error)

func uploadPhoto(ctx context.Context, cfg settings.R2, endpoint, name string, body io.ReadSeeker, opts UploadOptions, encode encodeFunc) (UploadResult, error) {
	if msg := validateR2(cfg); msg != "" {
		return UploadResult{}, &UploadError{Message: msg, NotConfigured: true}
	}
	base, msg := publicBase(cfg.PublicURL)
	if msg != "" {
		return UploadResult{}, &UploadError{Message: msg, NotConfigured: true}
	}

	key, size, err := photoKey(name, body)
	if err != nil {
		return UploadResult{}, fmt.Errorf("hash photo: %w", err)
	}
	client := newR2Client(cfg, endpoint)
	if stem := keyStem(name); stem != "" && !opts.KeepSameName {
		same, err := sameNamePhotos(ctx, client, cfg, base, stem, key)
		if err != nil {
			return UploadResult{}, &UploadError{
				Message:    "Couldn't check the bucket for a photo with the same name. " + describeR2Error(err),
				Cloudflare: cloudflareResponse(err),
			}
		}
		if len(same) > 0 {
			return UploadResult{}, &UploadError{
				Message:  "The bucket already has a different photo with this name.",
				SameName: same,
			}
		}
	}

	// The versions are made before anything is uploaded, so a photo that
	// can't be read leaves nothing behind in the bucket.
	encoded, err := encode(body)
	if err != nil {
		return UploadResult{}, &UploadError{Message: "Couldn't read this JPEG to make its resized versions.", NotAPhoto: true}
	}
	if _, err := body.Seek(0, io.SeekStart); err != nil {
		return UploadResult{}, fmt.Errorf("rewind photo: %w", err)
	}

	if err := putObject(ctx, client, cfg, key, body, size, "image/jpeg"); err != nil {
		return UploadResult{}, err
	}
	res := UploadResult{Uploaded: Uploaded{Key: key, URL: base + "/" + key}, Versions: map[string]Uploaded{}}
	for _, v := range encoded {
		vkey := VersionKey(key, v.Name)
		if err := putObject(ctx, client, cfg, vkey, bytes.NewReader(v.Data), int64(len(v.Data)), "image/webp"); err != nil {
			return UploadResult{}, err
		}
		res.Versions[v.Name] = Uploaded{Key: vkey, URL: base + "/" + vkey}
	}
	return res, nil
}

// putObject uploads body to key, failing with an *UploadError.
func putObject(ctx context.Context, client *s3.Client, cfg settings.R2, key string, body io.Reader, size int64, contentType string) error {
	_, err := client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(strings.TrimSpace(cfg.Bucket)),
		Key:           aws.String(key),
		Body:          body,
		ContentLength: aws.Int64(size),
		ContentType:   aws.String(contentType),
	})
	if err != nil {
		return &UploadError{Message: describeUploadError(err), Cloudflare: cloudflareResponse(err)}
	}
	return nil
}

// VersionKey is the object key of the version called name of the photo
// UploadPhoto put at key: photos/<hash>-<name>-xlarge.webp for
// photos/<hash>-<name>.jpg.
func VersionKey(key, name string) string {
	return strings.TrimSuffix(key, path.Ext(key)) + "-" + name + ".webp"
}

// sameNamePhotos lists the photos in the bucket that photoKey named with stem,
// other than key itself, newest first. key is the same photo under the same
// name, which uploading again just replaces.
func sameNamePhotos(ctx context.Context, client *s3.Client, cfg settings.R2, base, stem, key string) ([]BucketImage, error) {
	var same []BucketImage
	paginator := s3.NewListObjectsV2Paginator(client, &s3.ListObjectsV2Input{
		Bucket: aws.String(strings.TrimSpace(cfg.Bucket)),
		Prefix: aws.String("photos/"),
	})
	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, err
		}
		for _, obj := range page.Contents {
			k := aws.ToString(obj.Key)
			if m := photoKeyPattern.FindStringSubmatch(k); m == nil || m[1] != stem || k == key {
				continue
			}
			same = append(same, BucketImage{
				Key:      k,
				URL:      base + "/" + k,
				Size:     aws.ToInt64(obj.Size),
				Modified: aws.ToTime(obj.LastModified),
			})
		}
	}
	sort.SliceStable(same, func(i, j int) bool { return same[i].Modified.After(same[j].Modified) })
	return same, nil
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
			"In the bucket's settings, enable Public Development URL (or add a Custom Domain) and use that URL."
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

	stem := keyStem(name)
	if stem == "" {
		return "photos/" + hash + ".jpg", size, nil
	}
	return "photos/" + hash + "-" + stem + ".jpg", size, nil
}

// keyStem is the part of an object key photoKey takes from the photo's name.
func keyStem(name string) string {
	stem := strings.TrimSuffix(path.Base(strings.ReplaceAll(name, `\`, "/")), path.Ext(name))
	stem = strings.Trim(unsafeKeyChars.ReplaceAllString(strings.ToLower(stem), "-"), "-")
	if len(stem) > 60 {
		stem = strings.TrimRight(stem[:60], "-")
	}
	return stem
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
