package storage

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// listingTTL is how long a listing of the bucket's photos is reused. Changes
// made through the pipeline drop it at once, so this only bounds how long a
// change made elsewhere (the Cloudflare dashboard, another copy of the
// pipeline) can go unseen.
const listingTTL = 10 * time.Minute

// photoListing is what FindPhotos needs from a listing of photos/: every key,
// and the newest upload for each name stem.
type photoListing struct {
	keys   map[string]bool
	newest map[string]upload
}

// cachedListing is a listing kept for reuse, with the bucket it's of and the
// count of bucket changes when it was read.
type cachedListing struct {
	bucket  string
	changes uint64
	read    time.Time
	listing photoListing
}

// listings holds the last listing. Its lock is held while R2 is listed, so
// pages asking at the same time (the Gallery and Photos in Flight) share one
// listing instead of each reading the whole bucket.
var listings struct {
	sync.Mutex
	last *cachedListing
}

// listPhotos lists photos/ in the bucket, reusing the last listing when it's of
// the same bucket, under listingTTL old, and nothing has changed a bucket
// since. A failed listing is never kept.
func listPhotos(ctx context.Context, cfg settings.R2, endpoint string) (photoListing, error) {
	bucket := endpoint + "/" + strings.TrimSpace(cfg.Bucket)
	listings.Lock()
	defer listings.Unlock()
	if last := listings.last; last != nil &&
		last.bucket == bucket && last.changes == bucketChanges.Load() && time.Since(last.read) < listingTTL {
		return last.listing, nil
	}
	changes := bucketChanges.Load()
	listing, err := readPhotoListing(ctx, cfg, endpoint)
	if err != nil {
		return photoListing{}, err
	}
	listings.last = &cachedListing{bucket: bucket, changes: changes, read: time.Now(), listing: listing}
	return listing, nil
}

// readPhotoListing lists every object under photos/ in the bucket, page by page.
func readPhotoListing(ctx context.Context, cfg settings.R2, endpoint string) (photoListing, error) {
	listing := photoListing{keys: map[string]bool{}, newest: map[string]upload{}}
	paginator := s3.NewListObjectsV2Paginator(newR2Client(cfg, endpoint), &s3.ListObjectsV2Input{
		Bucket: aws.String(strings.TrimSpace(cfg.Bucket)),
		Prefix: aws.String("photos/"),
	})
	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return photoListing{}, err
		}
		for _, obj := range page.Contents {
			listing.add(aws.ToString(obj.Key), aws.ToTime(obj.LastModified))
		}
	}
	return listing, nil
}

// add notes the object at key, and makes it its name stem's newest upload
// when it's a photo UploadPhoto wrote, newer than the one noted so far.
func (l photoListing) add(key string, modified time.Time) {
	l.keys[key] = true
	m := photoKeyPattern.FindStringSubmatch(key)
	if m == nil {
		return
	}
	if cur, ok := l.newest[m[1]]; !ok || modified.After(cur.modified) {
		l.newest[m[1]] = upload{key: m[0], modified: modified}
	}
}
