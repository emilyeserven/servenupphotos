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

const dataDir = "apps/portfolio/src/data/photos/"

// newAllPhotosRepo serves owner/repo, whose default branch is main, with
// pulls open, pull request 7 changing files, and contents keyed by
// "path@ref" (ref "main", or "head7" for photoPull's head). It fails the test
// on anything but a read.
func newAllPhotosRepo(t *testing.T, pulls, files []map[string]any, contents map[string]string) *Client {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("%s %s: FindInPullRequest and Combined must only read", r.Method, r.URL.Path)
		}
		p := strings.TrimPrefix(r.URL.Path, "/repos/owner/repo")
		switch {
		case p == "":
			writeBody(w, http.StatusOK, map[string]any{"full_name": "owner/repo", "default_branch": "main"})
		case p == "/pulls":
			writeBody(w, http.StatusOK, pulls)
		case p == "/pulls/7/files":
			writeBody(w, http.StatusOK, files)
		case strings.HasPrefix(p, "/contents/"):
			content, ok := contents[strings.TrimPrefix(p, "/contents/")+"@"+r.URL.Query().Get("ref")]
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

func TestFindInPullRequest(t *testing.T) {
	const (
		published  = `{"file":"DSC0001.jpg","gpsPosition":"35 deg 39' 31.20\" N, 139 deg 42' 2.40\" E","createDate":"2026:10:01 09:00:00","images":{"full":null,"key":null}}`
		waiting    = `{"file":"DSC0002.jpg","gpsPosition":null,"createDate":"2026:10:02 09:00:00"}`
		onlyOnMain = `{"file":"DSC0009.jpg","gpsPosition":null,"createDate":"2026:10:09 09:00:00"}`
	)
	// The pull request's own ALLPHOTOS.json is stale (CI hasn't rebuilt it),
	// so DSC0002 is only found through its file. ALLPHOTOS.json on main isn't
	// read: pages check it from Combined.
	contents := map[string]string{
		dataDir + "ALLPHOTOS.json@main":  "[" + published + "," + onlyOnMain + "]",
		dataDir + "ALLPHOTOS.json@head7": "[" + published + "]",
		dataDir + "DSC0001.json@head7":   published,
		dataDir + "DSC0002.json@head7":   waiting,
	}
	files := []map[string]any{
		{"filename": dataDir + "DSC0001.json", "status": "modified", "blob_url": "https://github.com/owner/repo/blob/x/DSC0001.json"},
		{"filename": dataDir + "DSC0002.json", "status": "added", "blob_url": "https://github.com/owner/repo/blob/x/DSC0002.json"},
		{"filename": dataDir + "ALLPHOTOS.json", "status": "modified"},
		{"filename": dataDir + "gone.json", "status": "removed"},
	}
	gh := settings.GitHub{Repo: "owner/repo", Token: token}

	tests := []struct {
		name    string
		pulls   []map[string]any
		photo   PhotoIdentity
		source  string
		fileURL string
	}{
		{"changed in the pull request", []map[string]any{photoPull},
			PhotoIdentity{File: "DSC0001.jpg", GPSPosition: ptr(`35 deg 39' 31.20" N, 139 deg 42' 2.40" E`), CreateDate: ptr("2026:10:01 09:00:00")},
			"DSC0001.json in pull request #7", "https://github.com/owner/repo/blob/x/DSC0001.json"},
		{"only on the base branch", []map[string]any{photoPull},
			PhotoIdentity{File: "DSC0009.jpg", CreateDate: ptr("2026:10:09 09:00:00")}, "", ""},
		{"waiting in the pull request, both without GPS", []map[string]any{photoPull},
			PhotoIdentity{File: "DSC0002.jpg", CreateDate: ptr("2026:10:02 09:00:00")},
			"DSC0002.json in pull request #7", "https://github.com/owner/repo/blob/x/DSC0002.json"},
		{"different date", []map[string]any{photoPull},
			PhotoIdentity{File: "DSC0001.jpg", GPSPosition: ptr(`35 deg 39' 31.20" N, 139 deg 42' 2.40" E`), CreateDate: ptr("2026:10:01 09:00:01")}, "", ""},
		{"GPS on only one side", []map[string]any{photoPull},
			PhotoIdentity{File: "DSC0002.jpg", GPSPosition: ptr("0 deg N"), CreateDate: ptr("2026:10:02 09:00:00")}, "", ""},
		{"different name", []map[string]any{photoPull},
			PhotoIdentity{File: "DSC0003.jpg", CreateDate: ptr("2026:10:02 09:00:00")}, "", ""},
		{"no pull request open", []map[string]any{},
			PhotoIdentity{File: "DSC0002.jpg", CreateDate: ptr("2026:10:02 09:00:00")}, "", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := newAllPhotosRepo(t, tt.pulls, files, contents)
			got, err := c.FindInPullRequest(t.Context(), gh, tt.photo)
			if err != nil {
				t.Fatal(err)
			}
			if want := len(tt.pulls); len(got.Sources) != want {
				t.Errorf("sources = %+v, want %d", got.Sources, want)
			}
			if tt.source == "" {
				if len(got.Matches) != 0 {
					t.Errorf("matches = %+v, want none", got.Matches)
				}
				return
			}
			if len(got.Matches) != 1 || got.Matches[0].Source != tt.source || got.Matches[0].FileURL != tt.fileURL {
				t.Fatalf("matches = %+v, want one from %s at %s", got.Matches, tt.source, tt.fileURL)
			}
			if !strings.Contains(string(got.Matches[0].Entry), tt.photo.File) {
				t.Errorf("entry = %s", got.Matches[0].Entry)
			}
		})
	}
}

func TestFindInPullRequestSources(t *testing.T) {
	gh := settings.GitHub{Repo: "owner/repo", Token: token}
	files := []map[string]any{
		{"filename": dataDir + "bad.json", "status": "added"},
		{"filename": dataDir + "missing.json", "status": "added"},
	}
	c := newAllPhotosRepo(t, []map[string]any{photoPull}, files, map[string]string{
		dataDir + "bad.json@head7": `{not json`,
	})
	got, err := c.FindInPullRequest(t.Context(), gh, PhotoIdentity{File: "a.jpg"})
	if err != nil {
		t.Fatal(err)
	}
	want := AllPhotosSource{Label: "pull request #7", FileURL: "https://github.com/owner/repo/pull/7",
		Found: true, Error: "couldn't read bad.json, missing.json"}
	if len(got.Sources) != 1 || got.Sources[0] != want {
		t.Errorf("sources = %+v\nwant %+v", got.Sources, want)
	}
}

func TestFindInPullRequestNeedsSettings(t *testing.T) {
	var perr *PublishError
	_, err := New().FindInPullRequest(t.Context(), settings.GitHub{}, PhotoIdentity{File: "a.jpg"})
	if !errors.As(err, &perr) || perr.Status != http.StatusBadRequest {
		t.Errorf("err = %v, want a 400 asking for settings", err)
	}
	_, err = New().FindInPullRequest(t.Context(), settings.GitHub{Repo: "owner/repo", Token: token}, PhotoIdentity{})
	if !errors.As(err, &perr) || perr.Message != "file is required" {
		t.Errorf("err = %v, want file is required", err)
	}
}
