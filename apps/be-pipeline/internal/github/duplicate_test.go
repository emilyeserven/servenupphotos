package github

import (
	"encoding/base64"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// newAllPhotosRepo serves owner/repo, whose default branch is main, with
// pulls open and ALLPHOTOS.json contents keyed by ref ("main", or "head7" for
// photoPull's head). It fails the test on anything but a read.
func newAllPhotosRepo(t *testing.T, pulls []map[string]any, byRef map[string]string) *Client {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("%s %s: FindInAllPhotos must only read", r.Method, r.URL.Path)
		}
		switch p := strings.TrimPrefix(r.URL.Path, "/repos/owner/repo"); p {
		case "":
			writeBody(w, http.StatusOK, map[string]any{"full_name": "owner/repo", "default_branch": "main"})
		case "/pulls":
			writeBody(w, http.StatusOK, pulls)
		case "/contents/apps/portfolio/src/data/ALLPHOTOS.json":
			content, ok := byRef[r.URL.Query().Get("ref")]
			if !ok {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			writeBody(w, http.StatusOK, map[string]any{
				"encoding": "base64",
				"content":  base64.StdEncoding.EncodeToString([]byte(content)),
			})
		default:
			t.Errorf("unexpected %s", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	return &Client{BaseURL: srv.URL, Client: srv.Client()}
}

func TestFindInAllPhotos(t *testing.T) {
	const (
		published = `{"file":"DSC0001.jpg","gpsPosition":"35 deg 39' 31.20\" N, 139 deg 42' 2.40\" E","createDate":"2026:10:01 09:00:00","images":{"full":null,"key":null}}`
		waiting   = `{"file":"DSC0002.jpg","gpsPosition":null,"createDate":"2026:10:02 09:00:00"}`
	)
	main := "[" + published + "]"
	// CI rebuilds the pull request's copy from every photo file, so it has both.
	head := "[" + published + "," + waiting + "]"
	gh := settings.GitHub{Repo: "owner/repo", Token: token}

	tests := []struct {
		name   string
		pulls  []map[string]any
		photo  PhotoIdentity
		source string
	}{
		{"on the base branch, listed once", []map[string]any{photoPull},
			PhotoIdentity{File: "DSC0001.jpg", GPSPosition: ptr(`35 deg 39' 31.20" N, 139 deg 42' 2.40" E`), CreateDate: ptr("2026:10:01 09:00:00")}, "main"},
		{"waiting in the pull request, both without GPS", []map[string]any{photoPull},
			PhotoIdentity{File: "DSC0002.jpg", CreateDate: ptr("2026:10:02 09:00:00")}, "pull request #7"},
		{"different date", []map[string]any{photoPull},
			PhotoIdentity{File: "DSC0001.jpg", GPSPosition: ptr(`35 deg 39' 31.20" N, 139 deg 42' 2.40" E`), CreateDate: ptr("2026:10:01 09:00:01")}, ""},
		{"GPS on only one side", []map[string]any{photoPull},
			PhotoIdentity{File: "DSC0002.jpg", GPSPosition: ptr("0 deg N"), CreateDate: ptr("2026:10:02 09:00:00")}, ""},
		{"different name", []map[string]any{photoPull},
			PhotoIdentity{File: "DSC0003.jpg", CreateDate: ptr("2026:10:02 09:00:00")}, ""},
		{"no pull request open", []map[string]any{},
			PhotoIdentity{File: "DSC0002.jpg", CreateDate: ptr("2026:10:02 09:00:00")}, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := newAllPhotosRepo(t, tt.pulls, map[string]string{"main": main, "head7": head})
			got, err := c.FindInAllPhotos(t.Context(), gh, tt.photo)
			if err != nil {
				t.Fatal(err)
			}
			if tt.source == "" {
				if len(got.Matches) != 0 {
					t.Errorf("matches = %+v, want none", got.Matches)
				}
				return
			}
			if len(got.Matches) != 1 || got.Matches[0].Source != tt.source {
				t.Fatalf("matches = %+v, want one from %s", got.Matches, tt.source)
			}
			if !strings.Contains(string(got.Matches[0].Entry), tt.photo.File) {
				t.Errorf("entry = %s", got.Matches[0].Entry)
			}
			if !strings.HasPrefix(got.Matches[0].FileURL, "https://github.com/owner/repo/blob/") {
				t.Errorf("FileURL = %q", got.Matches[0].FileURL)
			}
		})
	}
}

func TestFindInAllPhotosSources(t *testing.T) {
	gh := settings.GitHub{Repo: "owner/repo", Token: token}
	c := newAllPhotosRepo(t, []map[string]any{photoPull}, map[string]string{"head7": `{"not":"an array"}`})
	got, err := c.FindInAllPhotos(t.Context(), gh, PhotoIdentity{File: "a.jpg"})
	if err != nil {
		t.Fatal(err)
	}
	want := []AllPhotosSource{
		{Label: "main", FileURL: "https://github.com/owner/repo/blob/main/apps/portfolio/src/data/ALLPHOTOS.json"},
		{Label: "pull request #7", FileURL: "https://github.com/owner/repo/blob/photo-data/2026-10-15-024500/apps/portfolio/src/data/ALLPHOTOS.json",
			Found: true, Error: "The file isn't a JSON array."},
	}
	if len(got.Sources) != 2 || got.Sources[0] != want[0] || got.Sources[1] != want[1] {
		t.Errorf("sources = %+v\nwant %+v", got.Sources, want)
	}
}

func TestFindInAllPhotosNeedsSettings(t *testing.T) {
	var perr *PublishError
	_, err := New().FindInAllPhotos(t.Context(), settings.GitHub{}, PhotoIdentity{File: "a.jpg"})
	if !errors.As(err, &perr) || perr.Status != http.StatusBadRequest {
		t.Errorf("err = %v, want a 400 asking for settings", err)
	}
	_, err = New().FindInAllPhotos(t.Context(), settings.GitHub{Repo: "owner/repo", Token: token}, PhotoIdentity{})
	if !errors.As(err, &perr) || perr.Message != "file is required" {
		t.Errorf("err = %v, want file is required", err)
	}
}
