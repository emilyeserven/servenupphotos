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

// FindPhotos looks in the bucket for photos uploaded under each of names, the
// photos' original file names, and returns the ones it finds by name. A photo
// matches when UploadPhoto would give it the same name stem; when several
// uploads match, the newest wins. problem says why the bucket couldn't be
// searched, when it couldn't.
func FindPhotos(ctx context.Context, cfg settings.R2, names []string) (found map[string]Uploaded, problem string) {
	return findPhotos(ctx, cfg, r2Endpoint(cfg), names)
}

func findPhotos(ctx context.Context, cfg settings.R2, endpoint string, names []string) (map[string]Uploaded, string) {
	if msg := validateR2(cfg); msg != "" {
		return nil, msg
	}
	base, msg := publicBase(cfg.PublicURL)
	if msg != "" {
		return nil, msg
	}

	type upload struct {
		key      string
		modified time.Time
	}
	newest := map[string]upload{}
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

	found := map[string]Uploaded{}
	for _, name := range names {
		if u, ok := newest[keyStem(name)]; ok && keyStem(name) != "" {
			found[name] = Uploaded{Key: u.key, URL: base + "/" + u.key}
		}
	}
	return found, ""
}
