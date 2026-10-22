package github

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// publishedRepo serves owner/repo with main as its default branch, the photo
// files in onBase on main and the ones in onBranch on photoPull's branch when
// pulls lists it, and records what it's asked to change.
type publishedRepo struct {
	pulls     []map[string]any
	pullFiles []map[string]any
	onBase    map[string]string
	onBranch  map[string]string
	put       map[string]string
	putPath   string
	newRef    string
	opened    map[string]string
}

const publishedDir = "apps/portfolio/src/data/photos"

func (f *publishedRepo) start(t *testing.T) *Client {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := strings.TrimPrefix(r.URL.Path, "/repos/owner/repo")
		ref := r.URL.Query().Get("ref")
		switch {
		case r.Method == http.MethodGet && p == "":
			writeBody(w, http.StatusOK, map[string]any{"full_name": "owner/repo", "default_branch": "main"})
		case r.Method == http.MethodGet && p == "/pulls":
			writeBody(w, http.StatusOK, f.pulls)
		case r.Method == http.MethodGet && p == "/pulls/7/files":
			writeBody(w, http.StatusOK, f.pullFiles)
		case r.Method == http.MethodGet && p == "/contents/"+publishedDir:
			if ref != "main" {
				t.Errorf("listed the folder at %q, want main", ref)
			}
			var entries []map[string]any
			for _, name := range []string{"ALLPHOTOS.json", "a.json", "b.json", "dummy.json", "notes.txt"} {
				entries = append(entries, map[string]any{
					"name": name, "path": publishedDir + "/" + name, "type": "file",
					"html_url": "https://github.com/owner/repo/blob/main/" + publishedDir + "/" + name,
				})
			}
			writeBody(w, http.StatusOK, entries)
		case r.Method == http.MethodGet && strings.HasPrefix(p, "/contents/"):
			files := f.onBase
			if ref != "main" {
				files = f.onBranch
			}
			content, ok := files[strings.TrimPrefix(p, "/contents/")]
			if !ok {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			writeBody(w, http.StatusOK, map[string]any{
				"encoding": "base64", "sha": "blob@" + ref,
				"content": base64.StdEncoding.EncodeToString([]byte(content)),
			})
		case r.Method == http.MethodGet && p == "/git/ref/heads/main":
			writeBody(w, http.StatusOK, map[string]any{"object": map[string]any{"sha": "main1"}})
		case r.Method == http.MethodPost && p == "/git/refs":
			var body map[string]string
			_ = json.NewDecoder(r.Body).Decode(&body)
			f.newRef = body["ref"]
			writeBody(w, http.StatusCreated, map[string]any{})
		case r.Method == http.MethodPut && strings.HasPrefix(p, "/contents/"):
			f.putPath = strings.TrimPrefix(p, "/contents/")
			_ = json.NewDecoder(r.Body).Decode(&f.put)
			writeBody(w, http.StatusOK, map[string]any{
				"content": map[string]any{"html_url": "https://github.com/owner/repo/blob/b/" + f.putPath},
				"commit":  map[string]any{"sha": "c0ffee3"},
			})
		case r.Method == http.MethodPost && p == "/pulls":
			_ = json.NewDecoder(r.Body).Decode(&f.opened)
			writeBody(w, http.StatusCreated, map[string]any{"number": 8, "html_url": "https://github.com/owner/repo/pull/8"})
		default:
			t.Errorf("unexpected %s %s", r.Method, r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	now := func() time.Time { return time.Date(2026, 10, 22, 3, 30, 0, 0, time.UTC) }
	return &Client{BaseURL: srv.URL, Client: srv.Client(), Now: now}
}

func TestPublished(t *testing.T) {
	repo := &publishedRepo{
		pulls:     []map[string]any{photoPull},
		pullFiles: []map[string]any{{"filename": publishedDir + "/b.json", "status": "modified"}},
		onBase: map[string]string{
			publishedDir + "/a.json": `{"file":"A.jpg","images":{"full":"https://pub/A.jpg","key":"A.jpg"}}`,
			publishedDir + "/b.json": `not json`,
		},
	}
	got, err := repo.start(t).Published(t.Context(), settings.GitHub{Repo: "owner/repo", Token: token})
	if err != nil {
		t.Fatalf("Published() error = %v", err)
	}
	if got.Branch != "main" || got.PullRequest == nil || got.PullRequest.Number != 7 {
		t.Errorf("Published() = branch %q, pull request %+v; want main and #7", got.Branch, got.PullRequest)
	}
	if len(got.Files) != 2 {
		t.Fatalf("Published() listed %d files, want a.json and b.json: %+v", len(got.Files), got.Files)
	}
	a, b := got.Files[0], got.Files[1]
	if a.Path != publishedDir+"/a.json" || a.Status != PublishedStatus || a.InFlight != "" ||
		a.PhotoName != "A.jpg" || a.ImageURL != "https://pub/A.jpg" || a.ImageKey != "A.jpg" || a.Error != "" {
		t.Errorf("a.json = %+v, want it read from main and not in flight", a)
	}
	if b.InFlight != "modified" || b.Error == "" || b.PhotoName != "b" {
		t.Errorf("b.json = %+v, want it marked modified in flight, with why it couldn't be read", b)
	}
}

func TestUpdatePublishedIntoOpenPull(t *testing.T) {
	file := publishedDir + "/a.json"
	repo := &publishedRepo{
		pulls:     []map[string]any{photoPull},
		pullFiles: []map[string]any{{"filename": publishedDir + "/other.json", "status": "added"}},
		onBase:    map[string]string{file: "{\"file\": \"A.jpg\"}\n"},
		onBranch:  map[string]string{file: "{\"file\": \"A.jpg\"}\n"},
	}
	got, err := repo.start(t).Update(t.Context(), settings.GitHub{Repo: "owner/repo", Token: token}, file, "", json.RawMessage(`{"file":"A.jpg","title":"Pond"}`))
	if err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	want := UpdatedFile{Path: file, FileURL: "https://github.com/owner/repo/blob/b/" + file, CommitSHA: "c0ffee3", Changed: true}
	if got != want {
		t.Errorf("Update() = %+v, want %+v", got, want)
	}
	if repo.put["branch"] != "photo-data/2026-10-15-024500" || repo.put["sha"] != "blob@photo-data/2026-10-15-024500" {
		t.Errorf("put %v, want over the branch's copy on the pull request's branch", repo.put)
	}
	if repo.newRef != "" || repo.opened != nil {
		t.Errorf("made %q and opened %v, want the open pull request used", repo.newRef, repo.opened)
	}
}

func TestUpdatePublishedOpensPull(t *testing.T) {
	file := publishedDir + "/a.json"
	repo := &publishedRepo{onBase: map[string]string{file: "{\"file\": \"A.jpg\"}\n"}}
	got, err := repo.start(t).Update(t.Context(), settings.GitHub{Repo: "owner/repo", Token: token}, file, "", json.RawMessage(`{"file":"A.jpg","title":"Pond"}`))
	if err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	if !got.Changed || !got.NewPullRequest || got.PullRequestURL != "https://github.com/owner/repo/pull/8" {
		t.Errorf("Update() = %+v, want it saved into a new pull request", got)
	}
	if repo.newRef != "refs/heads/photo-data/2026-10-22-033000" {
		t.Errorf("made %q, want a new photo-data/ branch", repo.newRef)
	}
	if repo.put["branch"] != "photo-data/2026-10-22-033000" || repo.put["sha"] != "blob@main" {
		t.Errorf("put %v, want over main's copy on the new branch", repo.put)
	}
	if repo.opened["title"] != PullRequestTitle || repo.opened["head"] != "photo-data/2026-10-22-033000" || repo.opened["base"] != "main" {
		t.Errorf("opened %v, want an Add photo data pull request from the new branch", repo.opened)
	}
}

func TestUpdatePublishedUnchanged(t *testing.T) {
	file := publishedDir + "/a.json"
	repo := &publishedRepo{onBase: map[string]string{file: "{\n  \"file\": \"A.jpg\"\n}\n"}}
	got, err := repo.start(t).Update(t.Context(), settings.GitHub{Repo: "owner/repo", Token: token}, file, "", json.RawMessage(`{"file": "A.jpg"}`))
	if err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	if got != (UpdatedFile{Path: file}) || repo.newRef != "" || repo.putPath != "" {
		t.Errorf("Update() = %+v, made %q, put %q; want nothing committed", got, repo.newRef, repo.putPath)
	}
}

func TestUpdatePublishedErrors(t *testing.T) {
	file := publishedDir + "/a.json"
	tests := []struct {
		name     string
		pulls    []map[string]any
		onBase   map[string]string
		onBranch map[string]string
		rename   string
		want     string
	}{
		{"rename", nil, map[string]string{file: "{}"}, nil, "Pond", "keeps its name"},
		{"not on main", nil, nil, nil, "", "isn't in the photo data pull request or on main"},
		{"not on the branch", []map[string]any{photoPull}, map[string]string{file: "{}"}, nil, "", "Update the branch from main"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &publishedRepo{pulls: tt.pulls, onBase: tt.onBase, onBranch: tt.onBranch}
			_, err := repo.start(t).Update(t.Context(), settings.GitHub{Repo: "owner/repo", Token: token}, file, tt.rename, json.RawMessage(`{"title":"Pond"}`))
			var perr *PublishError
			if !errors.As(err, &perr) || !strings.Contains(perr.Message, tt.want) {
				t.Errorf("Update() error = %v, want one containing %q", err, tt.want)
			}
			if repo.putPath != "" || repo.newRef != "" {
				t.Errorf("put %q and made %q, want nothing committed", repo.putPath, repo.newRef)
			}
		})
	}
}
