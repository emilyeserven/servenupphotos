package storage

import (
	"context"
	"errors"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/versions"
)

// PhotoKey is an original's key UploadPhoto wrote, photos/<hash>-<stem>.jpg,
// taken apart.
type PhotoKey struct {
	// Hash is the start of the photo's SHA-256, which stays when it's renamed.
	Hash string
	// Stem is the name part, such as "dsc0001"; "" for a key without one.
	Stem string
}

// ParsePhotoKey takes apart key, or reports false when it isn't an original
// UploadPhoto wrote.
func ParsePhotoKey(key string) (PhotoKey, bool) {
	m := photoKeyPattern.FindStringSubmatch(key)
	if m == nil {
		return PhotoKey{}, false
	}
	return PhotoKey{Hash: strings.TrimPrefix(key, "photos/")[:12], Stem: m[1]}, true
}

// Key is the original's object key.
func (k PhotoKey) Key() string {
	if k.Stem == "" {
		return "photos/" + k.Hash + ".jpg"
	}
	return "photos/" + k.Hash + "-" + k.Stem + ".jpg"
}

// accentFolds writes common accented Latin letters as their plain ones, so a
// title such as "Café" names its image "cafe" rather than "caf".
var accentFolds = strings.NewReplacer(
	"à", "a", "á", "a", "â", "a", "ã", "a", "ä", "a", "å", "a", "æ", "ae",
	"ç", "c", "è", "e", "é", "e", "ê", "e", "ë", "e", "ì", "i", "í", "i", "î", "i", "ï", "i",
	"ñ", "n", "ò", "o", "ó", "o", "ô", "o", "õ", "o", "ö", "o", "ø", "o", "œ", "oe",
	"ù", "u", "ú", "u", "û", "u", "ü", "u", "ý", "y", "ÿ", "y", "ß", "ss",
)

// TitleStem is the name stem a photo titled title gets in its keys, as
// UploadPhoto would name a file called title: "Amsterdam Canal" becomes
// "amsterdam-canal". It's "" when the title has no letters or numbers to name
// it by.
func TitleStem(title string) string {
	return cleanStem(accentFolds.Replace(strings.ToLower(title)))
}

// renamedVersions are the names of every version an original may have in the
// bucket next to it, the Square Thumbnail and its preview included.
func renamedVersions() []string {
	names := []string{versions.Thumbnail.Name, versions.ThumbnailPreview.Name}
	for _, v := range versions.All {
		names = append(names, v.Name)
	}
	return names
}

// CopyPhoto copies the original at from, one UploadPhoto wrote, to to, along
// with each of its versions in the bucket (skipping the ones it doesn't have),
// so the photo is under both names. Both keys must be originals of the same
// photo, with the same hash. Nothing is deleted: the old objects stay until
// they're deleted from Explore Bucket. It returns why the photo couldn't be
// copied, or "" when it was.
func CopyPhoto(ctx context.Context, cfg settings.R2, from, to string) string {
	return copyPhoto(ctx, cfg, r2Endpoint(cfg), from, to)
}

func copyPhoto(ctx context.Context, cfg settings.R2, endpoint, from, to string) string {
	if msg := validateR2(cfg); msg != "" {
		return msg
	}
	src, okFrom := ParsePhotoKey(from)
	dst, okTo := ParsePhotoKey(to)
	if !okFrom || !okTo || src.Hash != dst.Hash {
		return "Only a photo uploaded by the pipeline can be renamed, and only to another name for the same photo."
	}
	client := newR2Client(cfg, endpoint)
	if missing, msg := copyObject(ctx, client, cfg, from, to); missing {
		return "The original isn't in the bucket."
	} else if msg != "" {
		return msg
	}
	for _, name := range renamedVersions() {
		if _, msg := copyObject(ctx, client, cfg, VersionKey(from, name), VersionKey(to, name)); msg != "" {
			return msg
		}
	}
	return ""
}

// copyObject copies from to to in the bucket, keeping its content type and
// metadata (such as the Square Thumbnail's crop). missing is set when from
// isn't there; otherwise msg says why it couldn't be copied, or is "".
func copyObject(ctx context.Context, client *s3.Client, cfg settings.R2, from, to string) (missing bool, msg string) {
	bucket := strings.TrimSpace(cfg.Bucket)
	// Keys from ParsePhotoKey only hold a-z, 0-9, "-", "." and "/", so they
	// need no escaping in the copy source.
	_, err := client.CopyObject(ctx, &s3.CopyObjectInput{
		Bucket:     aws.String(bucket),
		Key:        aws.String(to),
		CopySource: aws.String(bucket + "/" + from),
	})
	if err == nil {
		return false, ""
	}
	var apiErr smithy.APIError
	if errors.As(err, &apiErr) && (apiErr.ErrorCode() == "NoSuchKey" || apiErr.ErrorCode() == "NotFound") {
		return true, ""
	}
	return false, "Couldn't copy " + from + ". " + describeUploadError(err)
}
