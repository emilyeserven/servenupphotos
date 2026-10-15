package storage

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

var validR2 = settings.R2{
	AccountID:       strings.Repeat("a", 32),
	AccessKeyID:     "key-id",
	SecretAccessKey: "secret",
	Bucket:          "photos",
}

// fakeR2 answers every request with status and, for errors, an S3 error body
// carrying code.
func fakeR2(t *testing.T, status int, code string) string {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/photos") {
			t.Errorf("request path = %q, want the photos bucket", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/xml")
		w.WriteHeader(status)
		if status == http.StatusOK {
			_, _ = fmt.Fprint(w, `<ListBucketResult><Name>photos</Name><KeyCount>0</KeyCount><MaxKeys>1</MaxKeys><IsTruncated>false</IsTruncated></ListBucketResult>`)
			return
		}
		_, _ = fmt.Fprintf(w, `<Error><Code>%s</Code><Message>from fake</Message></Error>`, code)
	}))
	t.Cleanup(srv.Close)
	return srv.URL
}

func TestCheckR2(t *testing.T) {
	tests := []struct {
		name   string
		status int
		code   string
		ok     bool
		want   string
	}{
		{"connected", http.StatusOK, "", true, "Connected to photos."},
		{"bad key id", http.StatusForbidden, "InvalidAccessKeyId", false, "didn't recognize the access key ID"},
		{"bad secret", http.StatusForbidden, "SignatureDoesNotMatch", false, "secret access key doesn't match"},
		{"no bucket", http.StatusNotFound, "NoSuchBucket", false, "no bucket with that name"},
		{"no permission", http.StatusForbidden, "AccessDenied", false, "isn't allowed to read"},
		{"other", http.StatusBadRequest, "SomethingElse", false, "Cloudflare said: from fake"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := checkR2(t.Context(), validR2, fakeR2(t, tt.status, tt.code))
			if got.OK != tt.ok || !strings.Contains(got.Message, tt.want) {
				t.Errorf("got %+v, want ok=%v with %q", got, tt.ok, tt.want)
			}
		})
	}
}

func TestCheckR2Validates(t *testing.T) {
	missing := validR2
	missing.SecretAccessKey = ""
	missing.Bucket = " "
	if got := CheckR2(t.Context(), missing); got.OK || got.Message != "Fill in Secret access key, Bucket first." {
		t.Errorf("missing fields: got %+v", got)
	}

	badAccount := validR2
	badAccount.AccountID = "evil.example.com/#"
	if got := CheckR2(t.Context(), badAccount); got.OK || !strings.Contains(got.Message, "account ID") {
		t.Errorf("bad account ID: got %+v", got)
	}
}

func TestCheckR2PublicURL(t *testing.T) {
	cfg := validR2
	cfg.PublicURL = "https://" + validR2.AccountID + ".r2.cloudflarestorage.com/photos"
	if got := CheckR2(t.Context(), cfg); got.OK || !strings.Contains(got.Message, "S3 API endpoint") {
		t.Errorf("got %+v, want the S3 API endpoint rejected as a public URL", got)
	}
}

func TestCheckR2Unreachable(t *testing.T) {
	srv := httptest.NewServer(http.NotFoundHandler())
	srv.Close()
	if got := checkR2(t.Context(), validR2, srv.URL); got.OK || !strings.Contains(got.Message, "Couldn't reach Cloudflare") {
		t.Errorf("got %+v", got)
	}
}
