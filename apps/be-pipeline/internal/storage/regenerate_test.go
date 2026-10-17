package storage

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/versions"
)

// fakeR2Regenerate serves original at key's path, answering any other GET
// with status and code, and records every PUT.
type fakeR2Regenerate struct {
	key, original string
	status        int
	code          string
	puts          []string
}

func (f *fakeR2Regenerate) start(t *testing.T) string {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			if r.URL.Path != "/photos/"+f.key || f.status != http.StatusOK {
				writeS3Error(w, f.status, f.code)
				return
			}
			_, _ = io.WriteString(w, f.original)
		case http.MethodPut:
			body, _ := io.ReadAll(r.Body)
			f.puts = append(f.puts, r.URL.Path+" "+r.Header.Get("Content-Type")+" "+string(body))
		default:
			t.Errorf("method = %s, want GET or PUT", r.Method)
		}
	}))
	t.Cleanup(srv.Close)
	return srv.URL
}

// fakeEncodeOnly stands in for versions.EncodeOnly, making each of vs from whatever it's given.
func fakeEncodeOnly(photo io.Reader, vs []versions.Version) ([]versions.Encoded, error) {
	data, err := io.ReadAll(photo)
	if err != nil {
		return nil, err
	}
	var out []versions.Encoded
	for _, v := range vs {
		out = append(out, versions.Encoded{Version: v, Data: append([]byte(v.Name+":"), data...)})
	}
	return out, nil
}

func TestRegenerateVersions(t *testing.T) {
	cfg := validR2
	cfg.PublicURL = "https://pub-123.r2.dev"
	const key = "photos/233d38afbc8e-img-0001.jpg"
	fake := &fakeR2Regenerate{key: key, original: "jpeg", status: http.StatusOK}
	large, _ := versions.Find("large")
	small, _ := versions.Find("small")

	got, err := regenerateVersions(t.Context(), cfg, fake.start(t), key, []versions.Version{large, small}, fakeEncodeOnly)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{
		"/photos/photos/233d38afbc8e-img-0001-large.webp image/webp large:jpeg",
		"/photos/photos/233d38afbc8e-img-0001-small.webp image/webp small:jpeg",
	}
	if !slices.Equal(fake.puts, want) {
		t.Errorf("puts = %q, want %q", fake.puts, want)
	}
	if len(got) != 2 || got["large"].URL != "https://pub-123.r2.dev/photos/233d38afbc8e-img-0001-large.webp" {
		t.Errorf("got %+v", got)
	}
}

func TestRegenerateVersionsProblems(t *testing.T) {
	cfg := validR2
	cfg.PublicURL = "https://pub-123.r2.dev"
	failEncode := func(io.Reader, []versions.Version) ([]versions.Encoded, error) { return nil, errors.New("bad jpeg") }
	tests := []struct {
		name     string
		key      string
		status   int
		code     string
		encode   encodeOnlyFunc
		notFound bool
		want     string
	}{
		{"not an upload", "notes.txt", http.StatusOK, "", fakeEncodeOnly, true, "Only photos uploaded"},
		{"a version, not an original", "photos/233d38afbc8e-img-0001-large.webp", http.StatusOK, "", fakeEncodeOnly, true, "Only photos uploaded"},
		{"gone", "photos/233d38afbc8e-img-0001.jpg", http.StatusNotFound, "NoSuchKey", fakeEncodeOnly, true, "isn't in the bucket anymore"},
		{"refused", "photos/233d38afbc8e-img-0001.jpg", http.StatusForbidden, "AccessDenied", fakeEncodeOnly, false, "Couldn't download the original"},
		{"unreadable", "photos/233d38afbc8e-img-0001.jpg", http.StatusOK, "", failEncode, false, "Couldn't read the original JPEG"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := &fakeR2Regenerate{key: "photos/233d38afbc8e-img-0001.jpg", status: tt.status, code: tt.code}
			_, err := regenerateVersions(t.Context(), cfg, fake.start(t), tt.key, versions.All, tt.encode)
			var uerr *UploadError
			if !errors.As(err, &uerr) || uerr.NotFound != tt.notFound || !strings.Contains(uerr.Message, tt.want) {
				t.Errorf("err = %+v, want NotFound %v with %q", err, tt.notFound, tt.want)
			}
			if len(fake.puts) > 0 {
				t.Errorf("puts = %q, want nothing uploaded", fake.puts)
			}
		})
	}
}
