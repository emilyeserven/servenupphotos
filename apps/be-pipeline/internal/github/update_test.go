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

// updateRepo serves owner/repo with photoPull open, changing files, and
// records the body of the one PUT it receives.
type updateRepo struct {
	files     []map[string]any
	current   string
	putStatus int
	put       map[string]string
	putPath   string
}

func (f *updateRepo) start(t *testing.T) *Client {
	t.Helper()
	const dir = "apps/portfolio/src/data/photos/"
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := strings.TrimPrefix(r.URL.Path, "/repos/owner/repo")
		switch {
		case r.Method == http.MethodGet && p == "/pulls":
			writeBody(w, http.StatusOK, []map[string]any{photoPull})
		case r.Method == http.MethodGet && p == "/pulls/7/files":
			writeBody(w, http.StatusOK, f.files)
		case r.Method == http.MethodGet && p == "/contents/"+dir+"DSC0001.json":
			if r.URL.Query().Get("ref") != "photo-data/2026-10-15-024500" {
				t.Errorf("read at ref %q, want the branch", r.URL.Query().Get("ref"))
			}
			writeBody(w, http.StatusOK, map[string]any{
				"encoding": "base64", "sha": "blob1",
				"content": base64.StdEncoding.EncodeToString([]byte(f.current)),
			})
		case r.Method == http.MethodPut && strings.HasPrefix(p, "/contents/"):
			f.putPath = strings.TrimPrefix(p, "/contents/")
			_ = json.NewDecoder(r.Body).Decode(&f.put)
			writeBody(w, f.putStatus, map[string]any{
				"content": map[string]any{"html_url": "https://github.com/owner/repo/blob/b/" + f.putPath},
				"commit":  map[string]any{"sha": "c0ffee2"},
			})
		default:
			t.Errorf("unexpected %s %s", r.Method, r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	return &Client{BaseURL: srv.URL, Client: srv.Client()}
}

func TestUpdate(t *testing.T) {
	const file = "apps/portfolio/src/data/photos/DSC0001.json"
	repo := &updateRepo{
		files:     []map[string]any{{"filename": file, "status": "added", "blob_url": "https://github.com/blob"}},
		current:   "{\n  \"file\": \"DSC0001.jpg\"\n}\n",
		putStatus: http.StatusOK,
	}
	data := json.RawMessage(`{"file":"DSC0001.jpg","images":{"thumbnail":"https://pub/t.webp?crop=1,2,3"}}`)
	got, err := repo.start(t).Update(t.Context(), settings.GitHub{Repo: "owner/repo", Token: token}, file, data)
	if err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	want := UpdatedFile{Path: file, FileURL: "https://github.com/owner/repo/blob/b/" + file, CommitSHA: "c0ffee2", Changed: true}
	if got != want {
		t.Errorf("Update() = %+v, want %+v", got, want)
	}
	if repo.putPath != file || repo.put["sha"] != "blob1" || repo.put["branch"] != "photo-data/2026-10-15-024500" {
		t.Errorf("put %q with %v, want over the file's blob on the pull request's branch", repo.putPath, repo.put)
	}
	content, _ := base64.StdEncoding.DecodeString(repo.put["content"])
	wantContent := "{\n  \"file\": \"DSC0001.jpg\",\n  \"images\": {\n    \"thumbnail\": \"https://pub/t.webp?crop=1,2,3\"\n  }\n}\n"
	if string(content) != wantContent {
		t.Errorf("content = %q, want %q", content, wantContent)
	}
}

func TestUpdateUnchanged(t *testing.T) {
	const file = "apps/portfolio/src/data/photos/DSC0001.json"
	repo := &updateRepo{
		files:   []map[string]any{{"filename": file, "status": "added", "blob_url": "https://github.com/blob"}},
		current: "{\n  \"file\": \"DSC0001.jpg\"\n}\n",
	}
	got, err := repo.start(t).Update(t.Context(), settings.GitHub{Repo: "owner/repo", Token: token}, file, json.RawMessage(`{"file": "DSC0001.jpg"}`))
	if err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	if want := (UpdatedFile{Path: file, FileURL: "https://github.com/blob"}); got != want {
		t.Errorf("Update() = %+v, want %+v", got, want)
	}
	if repo.putPath != "" {
		t.Errorf("put %q, want nothing committed", repo.putPath)
	}
}

func TestUpdateErrors(t *testing.T) {
	const file = "apps/portfolio/src/data/photos/DSC0001.json"
	tests := []struct {
		name      string
		file      string
		data      string
		status    string
		putStatus int
		want      string
	}{
		{"outside the folder", "README.json", `{}`, "added", http.StatusOK, "Only photo JSON files"},
		{"ALLPHOTOS.json", "apps/portfolio/src/data/photos/ALLPHOTOS.json", `{}`, "added", http.StatusOK, "Only photo JSON files"},
		{"not an object", file, `[1]`, "added", http.StatusOK, "must be a JSON object"},
		{"null", file, `null`, "added", http.StatusOK, "must be a JSON object"},
		{"not in the pull request", "apps/portfolio/src/data/photos/other.json", `{}`, "added", http.StatusOK, "isn't in the photo data pull request"},
		{"removed", file, `{}`, "removed", http.StatusOK, "can't be edited"},
		{"changed meanwhile", file, `{}`, "added", http.StatusConflict, "changed on photo-data/"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &updateRepo{files: []map[string]any{{"filename": file, "status": tt.status}}, current: "{\"a\":1}", putStatus: tt.putStatus}
			_, err := repo.start(t).Update(t.Context(), settings.GitHub{Repo: "owner/repo", Token: token}, tt.file, json.RawMessage(tt.data))
			var perr *PublishError
			if !errors.As(err, &perr) || !strings.Contains(perr.Message, tt.want) {
				t.Errorf("Update() error = %v, want one containing %q", err, tt.want)
			}
			if tt.putStatus == http.StatusOK && repo.putPath != "" {
				t.Errorf("put %q, want nothing committed", repo.putPath)
			}
		})
	}
}
