package storage

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

// A HEAD that R2 answers with a passing 500 is asked again and works.
func TestThumbnailMetadataRetriesPassingFailure(t *testing.T) {
	var heads atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if heads.Add(1) == 1 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("x-amz-meta-crop", "10,20,300")
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(srv.Close)

	crop, _, err := thumbnailMetadata(t.Context(), newR2Client(validR2, srv.URL), validR2, "photos/aaaaaaaaaaaa-a.jpg")
	if err != nil {
		t.Fatal(err)
	}
	if crop == nil || heads.Load() != 2 {
		t.Fatalf("crop %v after %d HEADs, want a crop after 2", crop, heads.Load())
	}
}

// A HEAD that keeps failing says what Cloudflare answered, which request it
// was and how many times it was sent.
func TestThumbnailMetadataFailureDetails(t *testing.T) {
	var heads atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		heads.Add(1)
		w.Header().Set("CF-Ray", "8abc123-NRT")
		w.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(srv.Close)

	cfg := validR2
	_, _, err := thumbnailMetadata(t.Context(), newR2Client(cfg, srv.URL), cfg, "photos/aaaaaaaaaaaa-a.jpg")
	var uerr *UploadError
	if !errors.As(err, &uerr) || uerr.Cloudflare == nil {
		t.Fatalf("got %v, want an UploadError with Cloudflare's answer", err)
	}
	cf := uerr.Cloudflare
	if cf.Status != http.StatusInternalServerError || cf.Ray != "8abc123-NRT" || cf.Operation != "HeadObject" ||
		cf.Request != "HEAD /"+cfg.Bucket+"/photos/aaaaaaaaaaaa-a-thumbnail.webp" || cf.Attempts != r2ReadAttempts {
		t.Fatalf("got %+v", cf)
	}
	if heads.Load() != r2ReadAttempts {
		t.Fatalf("sent %d HEADs, want %d", heads.Load(), r2ReadAttempts)
	}
}

// An upload isn't sent again after a 500: its body may be a stream.
func TestUploadNotRetried(t *testing.T) {
	var puts atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		puts.Add(1)
		w.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(srv.Close)

	cfg := validR2
	if err := putObject(t.Context(), newR2Client(cfg, srv.URL), cfg, "photos/x.jpg", http.NoBody, 0, "image/jpeg", nil); err == nil {
		t.Fatal("want an error")
	}
	if puts.Load() != 1 {
		t.Fatalf("sent %d PUTs, want 1", puts.Load())
	}
}
