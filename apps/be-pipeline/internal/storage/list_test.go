package storage

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestListImages(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || r.URL.Query().Get("prefix") != "" {
			t.Errorf("%s %s, want a listing of the whole bucket", r.Method, r.URL)
		}
		w.Header().Set("Content-Type", "application/xml")
		_, _ = fmt.Fprint(w, `<ListBucketResult><Name>photos</Name><IsTruncated>false</IsTruncated>`+
			`<Contents><Key>photos/aaaaaaaaaaaa-old.jpg</Key><Size>10</Size><LastModified>2026-10-01T00:00:00Z</LastModified></Contents>`+
			`<Contents><Key>notes.txt</Key><Size>3</Size><LastModified>2026-10-03T00:00:00Z</LastModified></Contents>`+
			`<Contents><Key>misc/New.PNG</Key><Size>20</Size><LastModified>2026-10-02T00:00:00Z</LastModified></Contents>`+
			`</ListBucketResult>`)
	}))
	t.Cleanup(srv.Close)

	cfg := validR2
	cfg.PublicURL = "https://pub.example.r2.dev/"
	images, err := listImages(t.Context(), cfg, srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	if len(images) != 2 {
		t.Fatalf("images = %+v, want the two images", images)
	}
	if images[0].Key != "misc/New.PNG" || images[0].URL != "https://pub.example.r2.dev/misc/New.PNG" || images[0].Size != 20 {
		t.Errorf("images[0] = %+v, want the newer PNG first", images[0])
	}
	if images[1].Key != "photos/aaaaaaaaaaaa-old.jpg" {
		t.Errorf("images[1] = %+v, want the older JPEG", images[1])
	}
}

func TestListImagesProblems(t *testing.T) {
	var lerr *ListError
	if _, err := listImages(t.Context(), validR2, fakeR2(t, http.StatusOK, "")); !errors.As(err, &lerr) || !lerr.NotConfigured || !strings.Contains(lerr.Message, "Public URL") {
		t.Errorf("err = %v, want a not-configured error asking for the public URL", err)
	}
	cfg := validR2
	cfg.PublicURL = "https://pub.example.r2.dev"
	if _, err := listImages(t.Context(), cfg, fakeR2(t, http.StatusForbidden, "AccessDenied")); !errors.As(err, &lerr) || lerr.NotConfigured || !strings.Contains(lerr.Message, "isn't allowed to read") {
		t.Errorf("err = %v, want an access error", err)
	}
}
