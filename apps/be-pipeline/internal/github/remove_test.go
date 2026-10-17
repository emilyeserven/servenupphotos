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

// removeRepo serves owner/repo with photoPull open, changing files, and
// records the body of the one DELETE it receives.
type removeRepo struct {
	files        []map[string]any
	deleteStatus int
	deleted      map[string]string
	deletedPath  string
}

func (f *removeRepo) start(t *testing.T) *Client {
	t.Helper()
	const dir = "apps/portfolio/src/data/"
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
			content := `{"file":"DSC0001.jpg","images":{"full":"https://pub/photos/a-dsc0001.jpg","key":"photos/a-dsc0001.jpg"}}`
			writeBody(w, http.StatusOK, map[string]any{
				"encoding": "base64", "sha": "blob1",
				"content": base64.StdEncoding.EncodeToString([]byte(content)),
			})
		case r.Method == http.MethodDelete && strings.HasPrefix(p, "/contents/"):
			f.deletedPath = strings.TrimPrefix(p, "/contents/")
			_ = json.NewDecoder(r.Body).Decode(&f.deleted)
			writeBody(w, f.deleteStatus, map[string]any{"commit": map[string]any{"sha": "c0ffee1"}})
		default:
			t.Errorf("unexpected %s %s", r.Method, r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	return &Client{BaseURL: srv.URL, Client: srv.Client()}
}

func TestRemove(t *testing.T) {
	const file = "apps/portfolio/src/data/DSC0001.json"
	repo := &removeRepo{files: []map[string]any{{"filename": file, "status": "added"}}, deleteStatus: http.StatusOK}
	got, err := repo.start(t).Remove(t.Context(), settings.GitHub{Repo: "owner/repo", Token: token}, file)
	if err != nil {
		t.Fatalf("Remove() error = %v", err)
	}
	want := RemovedFile{
		Path: file, PhotoName: "DSC0001.jpg", ImageURL: "https://pub/photos/a-dsc0001.jpg", ImageKey: "photos/a-dsc0001.jpg",
		CommitSHA: "c0ffee1",
	}
	if got != want {
		t.Errorf("Remove() = %+v, want %+v", got, want)
	}
	if repo.deletedPath != file || repo.deleted["sha"] != "blob1" || repo.deleted["branch"] != "photo-data/2026-10-15-024500" {
		t.Errorf("deleted %q with %v, want the file's blob on the pull request's branch", repo.deletedPath, repo.deleted)
	}
}

func TestRemoveErrors(t *testing.T) {
	const file = "apps/portfolio/src/data/DSC0001.json"
	tests := []struct {
		name         string
		file         string
		status       string
		deleteStatus int
		want         string
	}{
		{"outside the folder", "README.json", "added", http.StatusOK, "Only photo JSON files"},
		{"ALLPHOTOS.json", "apps/portfolio/src/data/ALLPHOTOS.json", "added", http.StatusOK, "Only photo JSON files"},
		{"not in the pull request", "apps/portfolio/src/data/other.json", "added", http.StatusOK, "isn't in the photo data pull request"},
		{"already merged", file, "modified", http.StatusOK, "Only new files can be removed"},
		{"changed meanwhile", file, "added", http.StatusConflict, "changed on photo-data/"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &removeRepo{files: []map[string]any{{"filename": file, "status": tt.status}}, deleteStatus: tt.deleteStatus}
			_, err := repo.start(t).Remove(t.Context(), settings.GitHub{Repo: "owner/repo", Token: token}, tt.file)
			var perr *PublishError
			if !errors.As(err, &perr) || !strings.Contains(perr.Message, tt.want) {
				t.Errorf("Remove() error = %v, want one containing %q", err, tt.want)
			}
			if tt.deleteStatus == http.StatusOK && repo.deletedPath != "" {
				t.Errorf("deleted %q, want nothing deleted", repo.deletedPath)
			}
		})
	}
}
