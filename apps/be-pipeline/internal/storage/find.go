package storage

import (
	"context"
	"regexp"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// photoKeyPattern matches the keys UploadPhoto writes, capturing the name stem.
var photoKeyPattern = regexp.MustCompile(`^photos/[0-9a-f]{12}(?:-([a-z0-9-]+))?\.jpg$`)

// PhotoRef identifies a photo to look for in the bucket.
type PhotoRef struct {
	// Name is the photo's original file name.
	Name string
	// URL is the photo's public URL, when it was saved with the photo's data.
	URL string
}

// upload is the newest object found for a name stem.
type upload struct {
	key      string
	modified time.Time
}

// FindPhotos looks in the bucket for each of refs and returns the ones it
// finds. A ref with a URL under the bucket's public URL matches that object,
// and one with a URL elsewhere is returned as is. Otherwise a photo matches when
// UploadPhoto would give it the same name stem; when several uploads match,
// the newest wins. problem says why the bucket couldn't be searched, when it
// couldn't.
func FindPhotos(ctx context.Context, cfg settings.R2, refs []PhotoRef) (found map[PhotoRef]Uploaded, problem string) {
	return findPhotos(ctx, cfg, r2Endpoint(cfg), refs)
}

func findPhotos(ctx context.Context, cfg settings.R2, endpoint string, refs []PhotoRef) (map[PhotoRef]Uploaded, string) {
	if msg := validateR2(cfg); msg != "" {
		return nil, msg
	}
	base, msg := publicBase(cfg.PublicURL)
	if msg != "" {
		return nil, msg
	}

	newest := map[string]upload{}
	keys := map[string]bool{}
	paginator := s3.NewListObjectsV2Paginator(newR2Client(cfg, endpoint), &s3.ListObjectsV2Input{
		Bucket: aws.String(strings.TrimSpace(cfg.Bucket)),
		Prefix: aws.String("photos/"),
	})
	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, describeR2Error(err)
		}
		for _, obj := range page.Contents {
			keys[aws.ToString(obj.Key)] = true
			m := photoKeyPattern.FindStringSubmatch(aws.ToString(obj.Key))
			if m == nil {
				continue
			}
			modified := aws.ToTime(obj.LastModified)
			if cur, ok := newest[m[1]]; !ok || modified.After(cur.modified) {
				newest[m[1]] = upload{key: m[0], modified: modified}
			}
		}
	}

	found := map[PhotoRef]Uploaded{}
	for _, ref := range refs {
		if key, ok := refKey(ref, base, newest); ok && keys[key] {
			found[ref] = Uploaded{Key: key, URL: base + "/" + key}
		} else if !ok {
			found[ref] = Uploaded{URL: ref.URL}
		}
	}
	return found, ""
}

// refKey returns the object key ref points at, or ok false when its URL is
// outside the bucket's public URL base. The key is "" when nothing matches.
func refKey(ref PhotoRef, base string, newest map[string]upload) (key string, ok bool) {
	if ref.URL != "" {
		key, ok = strings.CutPrefix(ref.URL, base+"/")
		return key, ok
	}
	stem := keyStem(ref.Name)
	if u, found := newest[stem]; found && stem != "" {
		return u.key, true
	}
	return "", true
}
