package github

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/exif"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// fakeRepo is an in-memory owner/repo with default branch main, enough of the
// REST API for Publish.
type fakeRepo struct {
	mu       sync.Mutex
	branches map[string]bool
	files    map[string]string // "branch:path" → content
	pulls    []map[string]any
	writes   int
	failPUT  int
}

func newFakeRepo(t *testing.T) (*fakeRepo, *Client) {
	t.Helper()
	f := &fakeRepo{branches: map[string]bool{"main": true}, files: map[string]string{}}
	srv := httptest.NewServer(http.HandlerFunc(f.serve))
	t.Cleanup(srv.Close)
	now := time.Date(2026, 10, 15, 2, 45, 0, 0, time.UTC)
	return f, &Client{BaseURL: srv.URL, Client: srv.Client(), Now: func() time.Time { return now }}
}

func (f *fakeRepo) serve(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if r.Header.Get("Authorization") != "Bearer "+token {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	path := strings.TrimPrefix(r.URL.Path, "/repos/owner/repo")
	switch {
	case path == "" && r.Method == http.MethodGet:
		writeBody(w, http.StatusOK, map[string]any{"full_name": "owner/repo", "default_branch": "main"})
	case path == "/pulls" && r.Method == http.MethodGet:
		var open []map[string]any
		for _, pr := range f.pulls {
			if pr["base"] == r.URL.Query().Get("base") {
				open = append(open, pr)
			}
		}
		writeBody(w, http.StatusOK, append([]map[string]any{}, open...))
	case path == "/pulls" && r.Method == http.MethodPost:
		var in map[string]string
		_ = json.NewDecoder(r.Body).Decode(&in)
		n := len(f.pulls) + 1
		pr := map[string]any{
			"number":   n,
			"html_url": "https://github.com/owner/repo/pull/" + strconv.Itoa(n),
			"base":     in["base"],
			"head":     map[string]any{"ref": in["head"], "repo": map[string]any{"full_name": "owner/repo"}},
		}
		f.pulls = append(f.pulls, pr)
		writeBody(w, http.StatusCreated, pr)
	case strings.HasPrefix(path, "/git/ref/heads/"):
		if !f.branches[strings.TrimPrefix(path, "/git/ref/heads/")] {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		writeBody(w, http.StatusOK, map[string]any{"object": map[string]any{"sha": "abc123"}})
	case path == "/git/refs" && r.Method == http.MethodPost:
		var in map[string]string
		_ = json.NewDecoder(r.Body).Decode(&in)
		f.branches[strings.TrimPrefix(in["ref"], "refs/heads/")] = true
		writeBody(w, http.StatusCreated, map[string]any{})
	case strings.HasPrefix(path, "/contents/") && r.Method == http.MethodGet:
		key := r.URL.Query().Get("ref") + ":" + strings.TrimPrefix(path, "/contents/")
		if _, ok := f.files[key]; !ok {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		writeBody(w, http.StatusOK, map[string]any{})
	case strings.HasPrefix(path, "/contents/") && r.Method == http.MethodPut:
		if f.failPUT != 0 {
			w.WriteHeader(f.failPUT)
			return
		}
		var in map[string]string
		_ = json.NewDecoder(r.Body).Decode(&in)
		file := strings.TrimPrefix(path, "/contents/")
		content, _ := base64.StdEncoding.DecodeString(in["content"])
		f.files[in["branch"]+":"+file] = string(content)
		f.writes++
		writeBody(w, http.StatusCreated, map[string]any{
			"content": map[string]any{"html_url": "https://github.com/owner/repo/blob/" + in["branch"] + "/" + file},
		})
	default:
		w.WriteHeader(http.StatusNotFound)
	}
}

func writeBody(w http.ResponseWriter, status int, body any) {
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func ptr(s string) *string { return &s }

func ref[T any](v T) *T { return &v }

var gh = settings.GitHub{Repo: "owner/repo", Folder: "/photos/data/", Token: token}

func photo(name string) Photo {
	return Photo{Name: name, File: name + ".jpg", Sanitized: exif.Sanitized{
		Title:       ptr("Tokyo at night"),
		Camera:      ptr("X-T5"),
		Aperture:    ref(2.8),
		Exposure:    ptr("1/250"),
		ISO:         ref(400),
		FocalLength: ref(35.0),
		City:        ptr("Tokyo"),
		Comment:     ptr("Shot from the **bridge**."),
		Images: exif.Images{
			Full: ptr("https://photos.example.com/photos/0123456789ab-" + name + ".jpg"),
			Key:  ptr("photos/0123456789ab-" + name + ".jpg"),
		},
	}}
}

func TestPublishOpensThenReusesPullRequest(t *testing.T) {
	f, c := newFakeRepo(t)

	first, err := c.Publish(t.Context(), gh, photo("DSC0001"))
	if err != nil {
		t.Fatalf("first Publish() error = %v", err)
	}
	want := PublishResult{
		Path:              "photos/data/DSC0001.json",
		FileURL:           "https://github.com/owner/repo/blob/photo-data/2026-10-15-024500/photos/data/DSC0001.json",
		PullRequestURL:    "https://github.com/owner/repo/pull/1",
		PullRequestNumber: 1,
		NewPullRequest:    true,
	}
	if first != want {
		t.Errorf("first Publish() = %+v, want %+v", first, want)
	}

	second, err := c.Publish(t.Context(), gh, photo("DSC0002.json"))
	if err != nil {
		t.Fatalf("second Publish() error = %v", err)
	}
	if second.NewPullRequest || second.PullRequestNumber != 1 || second.Path != "photos/data/DSC0002.json" {
		t.Errorf("second Publish() = %+v, want it added to pull request 1", second)
	}
	if len(f.pulls) != 1 {
		t.Errorf("opened %d pull requests, want 1", len(f.pulls))
	}

	got := f.files["photo-data/2026-10-15-024500:photos/data/DSC0001.json"]
	wantJSON := `{
  "title": "Tokyo at night",
  "comment": "Shot from the **bridge**.",
  "file": "DSC0001.jpg",
  "camera": "X-T5",
  "lens": null,
  "aperture": 2.8,
  "exposure": "1/250",
  "iso": 400,
  "focalLength": 35,
  "gpsPosition": null,
  "createDate": null,
  "country": null,
  "city": "Tokyo",
  "width": null,
  "height": null,
  "images": {
    "full": "https://photos.example.com/photos/0123456789ab-DSC0001.jpg",
    "key": "photos/0123456789ab-DSC0001.jpg",
    "xlarge": null,
    "large": null,
    "medium": null,
    "small": null,
    "xsmall": null,
    "preview": null,
    "thumbnail": null,
    "thumbnailpreview": null
  }
}
`
	if got != wantJSON {
		t.Errorf("file content = %s, want %s", got, wantJSON)
	}
}

func TestPublishRefusesExistingFile(t *testing.T) {
	f, c := newFakeRepo(t)
	f.files["main:photos/data/DSC0001.json"] = "{}"

	_, err := c.Publish(t.Context(), gh, photo("DSC0001"))
	var perr *PublishError
	if !errors.As(err, &perr) || perr.Status != http.StatusConflict {
		t.Fatalf("Publish() error = %v, want a conflict", err)
	}
	if len(f.branches) != 1 || f.writes != 0 {
		t.Errorf("Publish() created a branch or file for an existing photo")
	}

	// A file saved earlier to the open pull request also counts.
	if _, err := c.Publish(t.Context(), gh, photo("DSC0002")); err != nil {
		t.Fatalf("Publish() error = %v", err)
	}
	_, err = c.Publish(t.Context(), gh, photo("DSC0002"))
	if !errors.As(err, &perr) || perr.Status != http.StatusConflict {
		t.Errorf("Publish() of a file already in the pull request: error = %v, want a conflict", err)
	}
}

func TestPublishIgnoresOtherPullRequests(t *testing.T) {
	f, c := newFakeRepo(t)
	f.pulls = append(f.pulls, map[string]any{
		"number": 9, "html_url": "https://github.com/owner/repo/pull/9", "base": "main",
		"head": map[string]any{"ref": "feature/x", "repo": map[string]any{"full_name": "owner/repo"}},
	}, map[string]any{
		"number": 10, "html_url": "https://github.com/fork/repo/pull/10", "base": "main",
		"head": map[string]any{"ref": "photo-data/x", "repo": map[string]any{"full_name": "fork/repo"}},
	})

	got, err := c.Publish(t.Context(), gh, photo("DSC0001"))
	if err != nil {
		t.Fatalf("Publish() error = %v", err)
	}
	if !got.NewPullRequest || got.PullRequestNumber != 3 {
		t.Errorf("Publish() = %+v, want a new pull request", got)
	}
}

func TestPublishErrors(t *testing.T) {
	tests := []struct {
		name    string
		gh      settings.GitHub
		photo   Photo
		failPUT int
		status  int
		message string
	}{
		{
			name:    "bad file name",
			gh:      gh,
			photo:   photo("../secrets"),
			status:  http.StatusBadRequest,
			message: "Use a file name of letters, numbers, dots, dashes and underscores.",
		},
		{
			name:    "bad folder",
			gh:      settings.GitHub{Repo: "owner/repo", Folder: "a/../b", Token: token},
			photo:   photo("DSC0001"),
			status:  http.StatusBadRequest,
			message: "The folder in Settings isn't a valid path.",
		},
		{
			name:    "not set up",
			gh:      settings.GitHub{Folder: "photos"},
			photo:   photo("DSC0001"),
			status:  http.StatusBadRequest,
			message: "Set the GitHub repository and token in Settings first.",
		},
		{
			name:    "missing base branch",
			gh:      settings.GitHub{Repo: "owner/repo", Branch: "nope", Token: token},
			photo:   photo("DSC0001"),
			status:  http.StatusBadGateway,
			message: `Branch "nope" wasn't found in owner/repo.`,
		},
		{
			name:    "no write access",
			gh:      gh,
			photo:   photo("DSC0001"),
			failPUT: http.StatusForbidden,
			status:  http.StatusBadGateway,
			message: "The token can't write to this repository. Give it Contents and Pull requests read and write access.",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f, c := newFakeRepo(t)
			f.failPUT = tt.failPUT
			_, err := c.Publish(t.Context(), tt.gh, tt.photo)
			var perr *PublishError
			if !errors.As(err, &perr) || perr.Status != tt.status || perr.Message != tt.message {
				t.Errorf("Publish() error = %v, want %d %q", err, tt.status, tt.message)
			}
		})
	}
}
