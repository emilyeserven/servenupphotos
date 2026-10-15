package github

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// newInFlightRepo serves an owner/repo whose open pull requests are pulls and
// whose pull request 7 changes files, with contents keyed by path at sha "head7".
func newInFlightRepo(t *testing.T, pulls []map[string]any, files []map[string]any, contents map[string]string) *Client {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer "+token {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if r.Method != http.MethodGet {
			t.Errorf("%s %s: InFlight must only read", r.Method, r.URL.Path)
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		p := strings.TrimPrefix(r.URL.Path, "/repos/owner/repo")
		switch {
		case p == "/pulls":
			writeBody(w, http.StatusOK, pulls)
		case p == "/pulls/7/files":
			writeBody(w, http.StatusOK, files)
		case strings.HasPrefix(p, "/contents/"):
			content, ok := contents[strings.TrimPrefix(p, "/contents/")]
			if !ok || r.URL.Query().Get("ref") != "head7" {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			writeBody(w, http.StatusOK, map[string]any{
				"encoding": "base64",
				"content":  base64.StdEncoding.EncodeToString([]byte(content)),
			})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	return &Client{BaseURL: srv.URL, Client: srv.Client()}
}

var photoPull = map[string]any{
	"number":   7,
	"title":    "Add photo data",
	"html_url": "https://github.com/owner/repo/pull/7",
	"head":     map[string]any{"ref": "photo-data/2026-10-15-024500", "sha": "head7"},
}

func TestInFlightReadsPhotoJSON(t *testing.T) {
	const dir = "apps/portfolio/src/data/"
	c := newInFlightRepo(t,
		[]map[string]any{{"number": 3, "title": "Unrelated", "head": map[string]any{"ref": "x", "sha": "s"}}, photoPull},
		[]map[string]any{
			{"filename": dir + "DSC0001.json", "status": "added", "blob_url": "https://github.com/blob/1"},
			{"filename": dir + "ALLPHOTOS.json", "status": "modified"},
			{"filename": dir + "DSC0002.json", "status": "removed"},
			{"filename": dir + "broken.json", "status": "added"},
			{"filename": dir + "nested/DSC0003.json", "status": "added"},
			{"filename": "README.md", "status": "modified"},
		},
		map[string]string{
			dir + "DSC0001.json": "{\n  \"file\": \"DSC0001.jpg\",\n  \"images\": {\"full\": \"https://pub/photos/a-dsc0001.jpg\", \"key\": \"photos/a-dsc0001.jpg\"}\n}\n",
			dir + "broken.json":  "{not json",
			// Formatted differently from DSC0001.json, as oxfmt leaves it.
			dir + "ALLPHOTOS.json": "[\n  { \"images\": { \"key\": \"photos/a-dsc0001.jpg\", \"full\": \"https://pub/photos/a-dsc0001.jpg\" }, \"file\": \"DSC0001.jpg\" },\n  { \"file\": \"other.jpg\" }\n]\n",
		},
	)

	got, err := c.InFlight(t.Context(), settings.GitHub{Repo: "owner/repo", Token: token})
	if err != nil {
		t.Fatalf("InFlight() error = %v", err)
	}
	if got.Folder != "apps/portfolio/src/data" || got.Repo != "owner/repo" {
		t.Errorf("Folder, Repo = %q, %q", got.Folder, got.Repo)
	}
	want := InFlightPullRequest{
		Number: 7, Title: "Add photo data", URL: "https://github.com/owner/repo/pull/7",
		Branch: "photo-data/2026-10-15-024500", HeadSHA: "head7",
	}
	if got.PullRequest == nil || *got.PullRequest != want {
		t.Fatalf("PullRequest = %+v, want %+v", got.PullRequest, want)
	}
	if len(got.Files) != 2 {
		t.Fatalf("Files = %+v, want DSC0001.json and broken.json", got.Files)
	}
	first := got.Files[0]
	var data map[string]any
	if err := json.Unmarshal(first.Data, &data); err != nil || data["file"] != "DSC0001.jpg" || first.Error != "" {
		t.Errorf("Files[0] = %+v, want DSC0001.json's data", first)
	}
	if first.InAllPhotos == nil || !*first.InAllPhotos || got.Files[1].InAllPhotos != nil {
		t.Errorf("InAllPhotos = %v, %v; want true, then nil for the invalid file", first.InAllPhotos, got.Files[1].InAllPhotos)
	}
	wantAll := InFlightAllPhotos{Path: dir + "ALLPHOTOS.json", Found: true, Count: 2}
	if got.AllPhotos != wantAll {
		t.Errorf("AllPhotos = %+v, want %+v", got.AllPhotos, wantAll)
	}
	if first.PhotoName != "DSC0001.jpg" || got.Files[1].PhotoName != "broken" {
		t.Errorf("PhotoName = %q, %q; want DSC0001.jpg, broken", first.PhotoName, got.Files[1].PhotoName)
	}
	if first.ImageKey != "photos/a-dsc0001.jpg" || got.Files[1].ImageKey != "" {
		t.Errorf("ImageKey = %q, %q; want DSC0001.json's images.key, none", first.ImageKey, got.Files[1].ImageKey)
	}
	if first.ImageURL != "https://pub/photos/a-dsc0001.jpg" || got.Files[1].ImageURL != "" {
		t.Errorf("ImageURL = %q, %q; want DSC0001.json's images.full, none", first.ImageURL, got.Files[1].ImageURL)
	}
	if first.FileURL != "https://github.com/blob/1" || first.Status != "added" {
		t.Errorf("Files[0] = %+v, want its blob URL and status", first)
	}
	if broken := got.Files[1]; broken.Data != nil || broken.Error != "The file isn't valid JSON." {
		t.Errorf("Files[1] = %+v, want an invalid JSON error", broken)
	}
}

func TestInFlightAllPhotos(t *testing.T) {
	const dir = "photos/"
	files := []map[string]any{{"filename": dir + "a.json", "status": "added"}}
	tests := []struct {
		name    string
		all     *string
		want    InFlightAllPhotos
		inPhoto string
	}{
		{"missing", nil, InFlightAllPhotos{Path: dir + "ALLPHOTOS.json"}, "null"},
		{"not an array", ptr(`{"a":1}`), InFlightAllPhotos{Path: dir + "ALLPHOTOS.json", Found: true, Error: "The file isn't a JSON array."}, "null"},
		{"null", ptr(`null`), InFlightAllPhotos{Path: dir + "ALLPHOTOS.json", Found: true, Error: "The file isn't a JSON array."}, "null"},
		{"empty", ptr(`[]`), InFlightAllPhotos{Path: dir + "ALLPHOTOS.json", Found: true}, "false"},
		{"key order", ptr(`[{"b":2,"a":1}]`), InFlightAllPhotos{Path: dir + "ALLPHOTOS.json", Found: true, Count: 1}, "true"},
		{"different value", ptr(`[{"a":1,"b":3}]`), InFlightAllPhotos{Path: dir + "ALLPHOTOS.json", Found: true, Count: 1}, "false"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			contents := map[string]string{dir + "a.json": `{"a":1,"b":2}`}
			if tt.all != nil {
				contents[dir+"ALLPHOTOS.json"] = *tt.all
			}
			c := newInFlightRepo(t, []map[string]any{photoPull}, files, contents)
			got, err := c.InFlight(t.Context(), settings.GitHub{Repo: "owner/repo", Folder: "photos", Token: token})
			if err != nil {
				t.Fatalf("InFlight() error = %v", err)
			}
			if got.AllPhotos != tt.want {
				t.Errorf("AllPhotos = %+v, want %+v", got.AllPhotos, tt.want)
			}
			if len(got.Files) != 1 {
				t.Fatalf("Files = %+v, want a.json", got.Files)
			}
			if in, _ := json.Marshal(got.Files[0].InAllPhotos); string(in) != tt.inPhoto {
				t.Errorf("InAllPhotos = %s, want %s", in, tt.inPhoto)
			}
		})
	}
}

func TestInFlightNoPullRequest(t *testing.T) {
	c := newInFlightRepo(t, []map[string]any{}, nil, nil)
	got, err := c.InFlight(t.Context(), settings.GitHub{Repo: "owner/repo", Folder: "/photos/", Token: token})
	if err != nil {
		t.Fatalf("InFlight() error = %v", err)
	}
	if got.PullRequest != nil || len(got.Files) != 0 || got.AllPhotos.Found || got.Folder != "photos" {
		t.Errorf("InFlight() = %+v, want no pull request in folder photos", got)
	}
}

func TestInFlightErrors(t *testing.T) {
	c := newInFlightRepo(t, []map[string]any{photoPull}, nil, nil)
	tests := []struct {
		name string
		gh   settings.GitHub
		want string
	}{
		{"not set up", settings.GitHub{Repo: "owner/repo"}, "Settings first"},
		{"bad folder", settings.GitHub{Repo: "owner/repo", Folder: "a/../b", Token: token}, "isn't a valid path"},
		{"bad token", settings.GitHub{Repo: "owner/repo", Token: "nope"}, "rejected the token"},
		{"unknown repo", settings.GitHub{Repo: "owner/other", Token: token}, "can't read this repository"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := c.InFlight(t.Context(), tt.gh)
			var perr *PublishError
			if !errors.As(err, &perr) || !strings.Contains(perr.Message, tt.want) {
				t.Errorf("InFlight() error = %v, want one containing %q", err, tt.want)
			}
		})
	}
}
