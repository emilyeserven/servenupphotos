package storage

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/versions"
)

// fakeR2Upload lists existing, each "key@RFC3339 time", for the same-name
// check, then records the one PUT it receives and answers with status and,
// for errors, an S3 error body carrying code. A listStatus other than 0 fails
// the listing the same way.
type fakeR2Upload struct {
	status     int
	code       string
	existing   []string
	listStatus int
	listed     bool
	// path, contentType and body are the first PUT's, the original photo.
	path, contentType string
	body              []byte
	// puts are the paths and content types of every PUT, in order.
	puts []string
}

// fakeEncode stands in for versions.EncodeUpload, making a version of each
// size from whatever it's given.
func fakeEncode(photo io.Reader, _ *versions.Crop) ([]versions.Encoded, error) {
	data, err := io.ReadAll(photo)
	if err != nil {
		return nil, err
	}
	var out []versions.Encoded
	for _, v := range versions.All {
		out = append(out, versions.Encoded{Version: v, Data: append([]byte(v.Name+":"), data...)})
	}
	return out, nil
}

func (f *fakeR2Upload) start(t *testing.T) string {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			f.listed = true
			if r.URL.Query().Get("prefix") != "photos/" {
				t.Errorf("listed %s, want photos/", r.URL)
			}
			if f.listStatus != 0 {
				writeS3Error(w, f.listStatus, f.code)
				return
			}
			var contents strings.Builder
			for _, k := range f.existing {
				key, modified, _ := strings.Cut(k, "@")
				fmt.Fprintf(&contents, "<Contents><Key>%s</Key><LastModified>%s</LastModified><Size>5</Size></Contents>", key, modified)
			}
			w.Header().Set("Content-Type", "application/xml")
			_, _ = fmt.Fprintf(w, `<ListBucketResult><Name>photos</Name><IsTruncated>false</IsTruncated>%s</ListBucketResult>`, contents.String())
		case http.MethodPut:
			body, _ := io.ReadAll(r.Body)
			if f.puts == nil {
				f.path, f.contentType, f.body = r.URL.Path, r.Header.Get("Content-Type"), body
			}
			f.puts = append(f.puts, r.URL.Path+" "+r.Header.Get("Content-Type")+" "+string(body))
			if f.status != http.StatusOK {
				writeS3Error(w, f.status, f.code)
			}
		default:
			t.Errorf("method = %s, want GET or PUT", r.Method)
		}
	}))
	t.Cleanup(srv.Close)
	return srv.URL
}

func writeS3Error(w http.ResponseWriter, status int, code string) {
	w.Header().Set("Content-Type", "application/xml")
	w.Header().Set("X-Amz-Request-Id", "req-123")
	w.WriteHeader(status)
	_, _ = fmt.Fprintf(w, `<Error><Code>%s</Code><Message>from fake</Message></Error>`, code)
}

func TestUploadPhoto(t *testing.T) {
	cfg := validR2
	cfg.PublicURL = "https://pub-123.r2.dev/"
	photo := []byte("\xff\xd8\xff\xe0 pretend jpeg")
	// The same photo uploaded before under its name, and a different name.
	fake := &fakeR2Upload{status: http.StatusOK, existing: []string{
		"photos/233d38afbc8e-img-0001.jpg@2026-10-01T00:00:00Z",
		"photos/aaaaaaaaaaaa-img-0002.jpg@2026-10-01T00:00:00Z",
	}}

	got, err := uploadPhoto(t.Context(), cfg, fake.start(t), "IMG_0001.JPG", bytes.NewReader(photo), UploadOptions{}, fakeEncode)
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

	const stem = "/photos/photos/233d38afbc8e-img-0001"
	wantPuts := []string{
		"/photos/" + key + " image/jpeg " + string(photo),
		stem + "-xlarge.webp image/webp xlarge:" + string(photo),
		stem + "-large.webp image/webp large:" + string(photo),
		stem + "-medium.webp image/webp medium:" + string(photo),
		stem + "-small.webp image/webp small:" + string(photo),
		stem + "-xsmall.webp image/webp xsmall:" + string(photo),
		stem + "-preview.webp image/webp preview:" + string(photo),
	}
	if !slices.Equal(fake.puts, wantPuts) {
		t.Errorf("PUTs = %q, want %q", fake.puts, wantPuts)
	}
	for _, v := range versions.All {
		vkey := "photos/233d38afbc8e-img-0001-" + v.Name + ".webp"
		if got.Versions[v.Name] != (Uploaded{Key: vkey, URL: "https://pub-123.r2.dev/" + vkey}) {
			t.Errorf("versions[%s] = %+v", v.Name, got.Versions[v.Name])
		}
	}
}

func TestUploadPhotoNotAPhoto(t *testing.T) {
	cfg := validR2
	cfg.PublicURL = "https://pub-123.r2.dev"
	fake := &fakeR2Upload{status: http.StatusOK}
	failEncode := func(io.Reader, *versions.Crop) ([]versions.Encoded, error) { return nil, errors.New("bad jpeg") }
	_, err := uploadPhoto(t.Context(), cfg, fake.start(t), "a.jpg", strings.NewReader("photo"), UploadOptions{}, failEncode)
	var uploadErr *UploadError
	if !errors.As(err, &uploadErr) || !uploadErr.NotAPhoto {
		t.Fatalf("err = %v, want a NotAPhoto UploadError", err)
	}
	if len(fake.puts) != 0 {
		t.Errorf("uploaded %q from a photo that couldn't be read", fake.puts)
	}
}

func TestUploadPhotoPassesTheCrop(t *testing.T) {
	cfg := validR2
	cfg.PublicURL = "https://pub-123.r2.dev"
	fake := &fakeR2Upload{status: http.StatusOK}
	crop := &versions.Crop{X: 10, Y: 20, Size: 300}
	var got *versions.Crop
	encode := func(photo io.Reader, c *versions.Crop) ([]versions.Encoded, error) {
		got = c
		return fakeEncode(photo, c)
	}
	if _, err := uploadPhoto(t.Context(), cfg, fake.start(t), "a.jpg", strings.NewReader("photo"), UploadOptions{Crop: crop}, encode); err != nil {
		t.Fatal(err)
	}
	if got != crop {
		t.Errorf("encoded with crop %+v, want %+v", got, crop)
	}
}

func TestUploadPhotoReportsTheThumbnailCrop(t *testing.T) {
	cfg := validR2
	cfg.PublicURL = "https://pub-123.r2.dev"
	fake := &fakeR2Upload{status: http.StatusOK}
	fitted := &versions.Crop{X: 0, Y: 20, Size: 300}
	encode := func(photo io.Reader, c *versions.Crop) ([]versions.Encoded, error) {
		out, err := fakeEncode(photo, c)
		return append(out, versions.Encoded{Version: versions.Thumbnail, Data: []byte("t"), Crop: fitted}), err
	}
	res, err := uploadPhoto(t.Context(), cfg, fake.start(t), "a.jpg", strings.NewReader("photo"), UploadOptions{}, encode)
	if err != nil {
		t.Fatal(err)
	}
	if res.ThumbnailCrop != fitted {
		t.Errorf("ThumbnailCrop = %+v, want %+v", res.ThumbnailCrop, fitted)
	}
}

func TestVersionKey(t *testing.T) {
	if got := VersionKey("photos/233d38afbc8e-img-0001.jpg", "small"); got != "photos/233d38afbc8e-img-0001-small.webp" {
		t.Errorf("VersionKey = %q", got)
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
			_, err := uploadPhoto(t.Context(), tt.cfg, fake.start(t), "a.jpg", strings.NewReader("photo"), UploadOptions{}, fakeEncode)
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
			if !tt.notConfigured {
				cf := uploadErr.Cloudflare
				if cf == nil || cf.Status != tt.status || cf.Code != tt.code || cf.Message != "from fake" ||
					cf.RequestID != "req-123" || !strings.Contains(cf.Error, tt.code) {
					t.Errorf("Cloudflare = %+v, want status %d and code %s from the response", cf, tt.status, tt.code)
				}
			}
		})
	}
}

func TestUploadPhotoSameName(t *testing.T) {
	cfg := validR2
	cfg.PublicURL = "https://pub-123.r2.dev"
	existing := []string{
		"photos/aaaaaaaaaaaa-img-0001.jpg@2026-10-01T00:00:00Z",
		"photos/bbbbbbbbbbbb-img-0001.jpg@2026-10-03T00:00:00Z",
		"photos/cccccccccccc-img-0001-2.jpg@2026-10-02T00:00:00Z",
		"photos/dddddddddddd.jpg@2026-10-02T00:00:00Z",
	}

	t.Run("stops and lists the other photos, newest first", func(t *testing.T) {
		fake := &fakeR2Upload{status: http.StatusOK, existing: existing}
		_, err := uploadPhoto(t.Context(), cfg, fake.start(t), "IMG_0001.jpg", strings.NewReader("photo"), UploadOptions{}, fakeEncode)
		var uploadErr *UploadError
		if !errors.As(err, &uploadErr) || uploadErr.NotConfigured {
			t.Fatalf("err = %v, want a same-name UploadError", err)
		}
		var keys []string
		for _, img := range uploadErr.SameName {
			keys = append(keys, img.Key)
		}
		if strings.Join(keys, " ") != "photos/bbbbbbbbbbbb-img-0001.jpg photos/aaaaaaaaaaaa-img-0001.jpg" {
			t.Errorf("SameName = %v", keys)
		}
		if got := uploadErr.SameName[0].URL; got != "https://pub-123.r2.dev/photos/bbbbbbbbbbbb-img-0001.jpg" {
			t.Errorf("URL = %q", got)
		}
		if fake.path != "" {
			t.Errorf("uploaded to %q despite the same name", fake.path)
		}
	})

	t.Run("keeps the name when asked", func(t *testing.T) {
		fake := &fakeR2Upload{status: http.StatusOK, existing: existing}
		if _, err := uploadPhoto(t.Context(), cfg, fake.start(t), "IMG_0001.jpg", strings.NewReader("photo"), UploadOptions{KeepSameName: true}, fakeEncode); err != nil {
			t.Fatal(err)
		}
		if fake.listed || fake.path == "" {
			t.Errorf("listed = %v, uploaded to %q; want no check and an upload", fake.listed, fake.path)
		}
	})

	t.Run("skips the check for a photo with no usable name", func(t *testing.T) {
		fake := &fakeR2Upload{status: http.StatusOK, existing: existing}
		if _, err := uploadPhoto(t.Context(), cfg, fake.start(t), "日本.jpg", strings.NewReader("photo"), UploadOptions{}, fakeEncode); err != nil {
			t.Fatal(err)
		}
		if fake.listed {
			t.Error("listed the bucket for an unnamed photo")
		}
	})

	t.Run("a failed check says what Cloudflare answered", func(t *testing.T) {
		fake := &fakeR2Upload{listStatus: http.StatusForbidden, code: "AccessDenied"}
		_, err := uploadPhoto(t.Context(), cfg, fake.start(t), "IMG_0001.jpg", strings.NewReader("photo"), UploadOptions{}, fakeEncode)
		var uploadErr *UploadError
		if !errors.As(err, &uploadErr) || !strings.Contains(uploadErr.Message, "same name") {
			t.Fatalf("err = %v, want the failed check", err)
		}
		if uploadErr.Cloudflare == nil || uploadErr.Cloudflare.Code != "AccessDenied" {
			t.Errorf("Cloudflare = %+v", uploadErr.Cloudflare)
		}
		if fake.path != "" {
			t.Errorf("uploaded to %q after a failed check", fake.path)
		}
	})
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
