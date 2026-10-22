package storage

import (
	"context"
	"path"
	"sort"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// imageExts are the file extensions ListImages treats as images.
var imageExts = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true, ".avif": true,
}

// BucketImage is one image object in the bucket.
type BucketImage struct {
	Key      string    `json:"key"`
	URL      string    `json:"url"`
	Size     int64     `json:"size"`
	Modified time.Time `json:"modified"`
}

// ListError is a listing failure with a reason fit to show the person
// browsing. NotConfigured is set when the R2 settings themselves are
// incomplete, as opposed to Cloudflare refusing the listing.
type ListError struct {
	Message       string
	NotConfigured bool
}

func (e *ListError) Error() string { return e.Message }

// ListImages returns every image object in the configured bucket, under any
// prefix, newest first, each with its public URL. Failures are *ListError.
func ListImages(ctx context.Context, cfg settings.R2) ([]BucketImage, error) {
	return listImages(ctx, cfg, r2Endpoint(cfg))
}

func listImages(ctx context.Context, cfg settings.R2, endpoint string) ([]BucketImage, error) {
	if msg := validateR2(cfg); msg != "" {
		return nil, &ListError{Message: msg, NotConfigured: true}
	}
	base, msg := publicBase(cfg.PublicURL)
	if msg != "" {
		return nil, &ListError{Message: msg, NotConfigured: true}
	}

	images := []BucketImage{}
	paginator := s3.NewListObjectsV2Paginator(newR2Client(cfg, endpoint), &s3.ListObjectsV2Input{
		Bucket: aws.String(strings.TrimSpace(cfg.Bucket)),
	})
	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, &ListError{Message: describeR2Error(err)}
		}
		for _, obj := range page.Contents {
			key := aws.ToString(obj.Key)
			if !imageExts[strings.ToLower(path.Ext(key))] {
				continue
			}
			images = append(images, BucketImage{
				Key:      key,
				URL:      base + "/" + key,
				Size:     aws.ToInt64(obj.Size),
				Modified: aws.ToTime(obj.LastModified),
			})
		}
	}
	sort.SliceStable(images, func(i, j int) bool {
		return images[i].Modified.After(images[j].Modified)
	})
	return images, nil
}
