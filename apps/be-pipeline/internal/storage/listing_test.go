package storage

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

// countingBucket lists one photo, or fails while failing is set, and counts
// the listings it was asked for. Any other request (a delete) is answered 204.
func countingBucket(t *testing.T, listed *atomic.Int32, failing *atomic.Bool) string {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		listed.Add(1)
		w.Header().Set("Content-Type", "application/xml")
		if failing.Load() {
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = fmt.Fprint(w, `<Error><Code>InternalError</Code><Message>from fake</Message></Error>`)
			return
		}
		_, _ = fmt.Fprint(w, `<ListBucketResult><Name>photos</Name><IsTruncated>false</IsTruncated>`+
			`<Contents><Key>photos/aaaaaaaaaaaa-a.jpg</Key><LastModified>2026-10-01T00:00:00Z</LastModified></Contents>`+
			`</ListBucketResult>`)
	}))
	t.Cleanup(srv.Close)
	return srv.URL
}

func TestFindPhotosReusesListing(t *testing.T) {
	cfg := validR2
	cfg.PublicURL = "https://pub.example.r2.dev"
	var listed atomic.Int32
	var failing atomic.Bool
	endpoint := countingBucket(t, &listed, &failing)
	refs := []PhotoRef{{Name: "a.jpg"}}
	find := func() {
		t.Helper()
		found, problem := findPhotos(t.Context(), cfg, endpoint, refs)
		if problem != "" || found[refs[0]].Key != "photos/aaaaaaaaaaaa-a.jpg" {
			t.Fatalf("found %v, problem %q", found, problem)
		}
	}

	find()
	find()
	if got := listed.Load(); got != 1 {
		t.Fatalf("listed %d times for two finds, want 1", got)
	}

	if msg := deleteObject(t.Context(), cfg, endpoint, "photos/other.jpg"); msg != "" {
		t.Fatal(msg)
	}
	find()
	if got := listed.Load(); got != 2 {
		t.Fatalf("listed %d times after a delete, want 2", got)
	}

	listings.last.read = time.Now().Add(-listingTTL)
	find()
	if got := listed.Load(); got != 3 {
		t.Fatalf("listed %d times after the listing got old, want 3", got)
	}

	// A failed listing isn't kept, so the next find lists again. R2's 500 is
	// asked r2ReadAttempts times before it counts as failed.
	listings.last.read = time.Now().Add(-listingTTL)
	failing.Store(true)
	if _, problem := findPhotos(t.Context(), cfg, endpoint, refs); problem == "" {
		t.Fatal("want a problem while R2 fails")
	}
	failing.Store(false)
	find()
	if got, want := listed.Load(), int32(3+r2ReadAttempts+1); got != want {
		t.Fatalf("listed %d times after a failure, want %d", got, want)
	}
}
