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

	byName := PhotoRef{Name: "DSCF0412.JPG"}
	byURL := PhotoRef{Name: "DSCF0412.JPG", URL: "https://pub.example.r2.dev/photos/aaaaaaaaaaaa-dscf0412.jpg"}
	elsewhere := PhotoRef{Name: "x.jpg", URL: "https://cdn.example.com/x.jpg"}
	byKey := PhotoRef{Name: "My Trip.jpg", URL: "https://old.example.com/a.jpg", Key: "photos/aaaaaaaaaaaa-dscf0412.jpg"}
	trip := PhotoRef{Name: "My Trip.jpg"}
	refs := []PhotoRef{
		byName, byURL, trip, elsewhere, byKey,
		{Name: "a.jpg", Key: "photos/gone.jpg"},
		{Name: "missing.jpg"}, {Name: "!!!.jpg"},
		{Name: "My Trip.jpg", URL: "https://pub.example.r2.dev/photos/gone.jpg"},
	}
	found, problem := findPhotos(t.Context(), cfg, endpoint, refs)
	if problem != "" {
		t.Fatalf("problem = %q", problem)
	}
	want := map[PhotoRef]Uploaded{
		byName:    {Key: "photos/bbbbbbbbbbbb-dscf0412.jpg", URL: "https://pub.example.r2.dev/photos/bbbbbbbbbbbb-dscf0412.jpg"},
		byURL:     {Key: "photos/aaaaaaaaaaaa-dscf0412.jpg", URL: "https://pub.example.r2.dev/photos/aaaaaaaaaaaa-dscf0412.jpg"},
		trip:      {Key: "photos/cccccccccccc-my-trip.jpg", URL: "https://pub.example.r2.dev/photos/cccccccccccc-my-trip.jpg"},
		elsewhere: {URL: "https://cdn.example.com/x.jpg"},
		byKey:     {Key: "photos/aaaaaaaaaaaa-dscf0412.jpg", URL: "https://pub.example.r2.dev/photos/aaaaaaaaaaaa-dscf0412.jpg"},
	}
	if len(found) != len(want) {
		t.Fatalf("found = %+v, want %+v", found, want)
	}
	for ref, u := range want {
		if found[ref] != u {
			t.Errorf("found[%+v] = %+v, want %+v", ref, found[ref], u)
		}
	}
}

func TestFindPhotosProblems(t *testing.T) {
	noURL := validR2
	if _, problem := findPhotos(t.Context(), noURL, fakeR2(t, http.StatusOK, ""), []PhotoRef{{Name: "a.jpg"}}); !strings.Contains(problem, "Public URL") {
		t.Errorf("problem = %q, want one asking for the public URL", problem)
	}
	cfg := validR2
	cfg.PublicURL = "https://pub.example.r2.dev"
	if _, problem := findPhotos(t.Context(), cfg, fakeR2(t, http.StatusForbidden, "AccessDenied"), []PhotoRef{{Name: "a.jpg"}}); !strings.Contains(problem, "isn't allowed to read") {
		t.Errorf("problem = %q, want an access error", problem)
	}
}
