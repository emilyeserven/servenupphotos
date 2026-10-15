package storage

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// fakeR2Upload records the one PUT it receives and answers with status and,
// for errors, an S3 error body carrying code.
type fakeR2Upload struct {
	status            int
	code              string
	path, contentType string
	body              []byte
}

func (f *fakeR2Upload) start(t *testing.T) string {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			t.Errorf("method = %s, want PUT", r.Method)
		}
		f.path, f.contentType = r.URL.Path, r.Header.Get("Content-Type")
		f.body, _ = io.ReadAll(r.Body)
		if f.status != http.StatusOK {
			w.Header().Set("Content-Type", "application/xml")
			w.WriteHeader(f.status)
			_, _ = fmt.Fprintf(w, `<Error><Code>%s</Code><Message>from fake</Message></Error>`, f.code)
		}
	}))
	t.Cleanup(srv.Close)
	return srv.URL
}

func TestUploadPhoto(t *testing.T) {
	cfg := validR2
	cfg.PublicURL = "https://pub-123.r2.dev/"
	photo := []byte("\xff\xd8\xff\xe0 pretend jpeg")
	fake := &fakeR2Upload{status: http.StatusOK}

	got, err := uploadPhoto(t.Context(), cfg, fake.start(t), "IMG_0001.JPG", bytes.NewReader(photo))
	if err != nil {
		t.Fatal(err)
	}

	const key = "photos/233d38afbc8e-img-0001.jpg"
	if got.Key != key || got.URL != "https://pub-123.r2.dev/"+key {
		t.Errorf("got %+v", got)
	}
	if fake.path != "/photos/"+key {
		t.Errorf("PUT path = %q, want the key in the photos bucket", fake.path)
	}
	if fake.contentType != "image/jpeg" {
		t.Errorf("content type = %q", fake.contentType)
	}
	if !bytes.Equal(fake.body, photo) {
		t.Errorf("uploaded %q, want the whole photo", fake.body)
	}
}

func TestUploadPhotoErrors(t *testing.T) {
	withURL := validR2
	withURL.PublicURL = "https://photos.example.com"
	noURL := validR2
	badURL := validR2
	badURL.PublicURL = "photos.example.com"
	apiURL := validR2
	apiURL.PublicURL = "https://" + validR2.AccountID + ".r2.cloudflarestorage.com/photos"
	noBucket := withURL
	noBucket.Bucket = ""

	tests := []struct {
		name          string
		cfg           settings.R2
		status        int
		code          string
		notConfigured bool
		want          string
	}{
		{"missing field", noBucket, 0, "", true, "Fill in Bucket first."},
		{"no public url", noURL, 0, "", true, "Fill in Public URL first"},
		{"bad public url", badURL, 0, "", true, "should start with https://"},
		{"s3 api endpoint as public url", apiURL, 0, "", true, "S3 API endpoint"},
		{"read-only token", withURL, http.StatusForbidden, "AccessDenied", false, "needs Object Read & Write"},
		{"no bucket", withURL, http.StatusNotFound, "NoSuchBucket", false, "no bucket with that name"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := &fakeR2Upload{status: tt.status, code: tt.code}
			_, err := uploadPhoto(t.Context(), tt.cfg, fake.start(t), "a.jpg", strings.NewReader("photo"))
			var uploadErr *UploadError
			if !errors.As(err, &uploadErr) {
				t.Fatalf("err = %v, want an UploadError", err)
			}
			if uploadErr.NotConfigured != tt.notConfigured || !strings.Contains(uploadErr.Message, tt.want) {
				t.Errorf("got %+v, want notConfigured=%v with %q", uploadErr, tt.notConfigured, tt.want)
			}
			if tt.notConfigured && fake.path != "" {
				t.Errorf("uploaded to %q despite incomplete settings", fake.path)
			}
		})
	}
}

func TestPhotoKey(t *testing.T) {
	tests := []struct{ name, want string }{
		{"IMG_0001.JPG", "photos/2cf24dba5fb0-img-0001.jpg"},
		{`C:\fakepath\Beach Day (2).jpeg`, "photos/2cf24dba5fb0-beach-day-2.jpg"},
		{"../../etc/passwd", "photos/2cf24dba5fb0-passwd.jpg"},
		{"日本.jpg", "photos/2cf24dba5fb0.jpg"},
		{"", "photos/2cf24dba5fb0.jpg"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body := strings.NewReader("hello")
			got, size, err := photoKey(tt.name, body)
			if err != nil {
				t.Fatal(err)
			}
			if got != tt.want || size != 5 {
				t.Errorf("got %q (%d bytes), want %q (5 bytes)", got, size, tt.want)
			}
			if rest, _ := io.ReadAll(body); string(rest) != "hello" {
				t.Errorf("body not rewound: %q left", rest)
			}
		})
	}
}
