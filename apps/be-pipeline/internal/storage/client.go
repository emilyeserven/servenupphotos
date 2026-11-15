package storage

import (
	"net/http"
	"sync/atomic"
)

// r2HTTP is the one HTTP client every R2 request goes through, so they reuse
// open connections instead of each starting a new TLS handshake with R2, which
// takes a noticeable moment on a Raspberry Pi. It also notes each change to the
// bucket, so the cached listing of photos (listing.go) knows when it's out of
// date.
var r2HTTP = &trackedClient{client: &http.Client{Transport: newR2Transport()}}

// bucketChanges counts the requests that changed a bucket (uploads, copies,
// deletes) since the backend started.
var bucketChanges atomic.Uint64

// newR2Transport is Go's default transport, keeping more idle connections to
// R2 open: uploads send several versions at once and the offline copy
// downloads four thumbnails at a time.
func newR2Transport() *http.Transport {
	t := http.DefaultTransport.(*http.Transport).Clone() //nolint:forcetypeassert // the standard library's own type
	t.MaxIdleConnsPerHost = 16
	return t
}

// trackedClient sends R2 requests and counts the ones that change a bucket.
type trackedClient struct {
	client *http.Client
}

// Do sends req. Anything but a GET or HEAD (PUT, POST, DELETE) can change the
// bucket, so it's counted once it's answered, even when it failed partway.
func (c *trackedClient) Do(req *http.Request) (*http.Response, error) {
	resp, err := c.client.Do(req)
	if req.Method != http.MethodGet && req.Method != http.MethodHead {
		bucketChanges.Add(1)
	}
	return resp, err
}
