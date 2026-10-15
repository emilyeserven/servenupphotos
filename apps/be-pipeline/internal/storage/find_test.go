package storage

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// fakeBucket lists keys, each "key@RFC3339 time", from the photos bucket.
func fakeBucket(t *testing.T, keys ...string) string {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || r.URL.Query().Get("prefix") != "photos/" {
			t.Errorf("%s %s, want a listing of photos/", r.Method, r.URL)
		}
		var contents strings.Builder
		for _, k := range keys {
			key, modified, _ := strings.Cut(k, "@")
			fmt.Fprintf(&contents, "<Contents><Key>%s</Key><LastModified>%s</LastModified></Contents>", key, modified)
		}
		w.Header().Set("Content-Type", "application/xml")
		_, _ = fmt.Fprintf(w, `<ListBucketResult><Name>photos</Name><IsTruncated>false</IsTruncated>%s</ListBucketResult>`, contents.String())
	}))
	t.Cleanup(srv.Close)
	return srv.URL
}

func TestFindPhotos(t *testing.T) {
	cfg := validR2
	cfg.PublicURL = "https://pub.example.r2.dev/"
	endpoint := fakeBucket(t,
		"photos/aaaaaaaaaaaa-dscf0412.jpg@2026-10-01T00:00:00Z",
		"photos/bbbbbbbbbbbb-dscf0412.jpg@2026-10-02T00:00:00Z",
		"photos/cccccccccccc-my-trip.jpg@2026-10-01T00:00:00Z",
		"photos/dddddddddddd.jpg@2026-10-01T00:00:00Z",
		"photos/notes.txt@2026-10-01T00:00:00Z",
	)

	found, problem := findPhotos(t.Context(), cfg, endpoint, []string{"DSCF0412.JPG", "My Trip.jpg", "missing.jpg", "!!!.jpg"})
	if problem != "" {
		t.Fatalf("problem = %q", problem)
	}
	want := map[string]Uploaded{
		"DSCF0412.JPG": {Key: "photos/bbbbbbbbbbbb-dscf0412.jpg", URL: "https://pub.example.r2.dev/photos/bbbbbbbbbbbb-dscf0412.jpg"},
		"My Trip.jpg":  {Key: "photos/cccccccccccc-my-trip.jpg", URL: "https://pub.example.r2.dev/photos/cccccccccccc-my-trip.jpg"},
	}
	if len(found) != len(want) {
		t.Fatalf("found = %+v, want %+v", found, want)
	}
	for name, u := range want {
		if found[name] != u {
			t.Errorf("found[%q] = %+v, want %+v", name, found[name], u)
		}
	}
}

func TestFindPhotosProblems(t *testing.T) {
	noURL := validR2
	if _, problem := findPhotos(t.Context(), noURL, fakeR2(t, http.StatusOK, ""), []string{"a.jpg"}); !strings.Contains(problem, "Public URL") {
		t.Errorf("problem = %q, want one asking for the public URL", problem)
	}
	cfg := validR2
	cfg.PublicURL = "https://pub.example.r2.dev"
	if _, problem := findPhotos(t.Context(), cfg, fakeR2(t, http.StatusForbidden, "AccessDenied"), []string{"a.jpg"}); !strings.Contains(problem, "isn't allowed to read") {
		t.Errorf("problem = %q, want an access error", problem)
	}
}
