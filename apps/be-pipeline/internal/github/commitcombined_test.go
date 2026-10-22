package github

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"maps"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

const dataRoot = "apps/portfolio/src/data"

// combinedRepo is a fake owner/repo with photoPull open, whose data folder at
// the pull request's head holds files (path → content), and that records the
// tree it's asked to commit and where the branch moved.
type combinedRepo struct {
	mu        sync.Mutex
	files     map[string]string
	message   string
	committed map[string]string
	commitMsg string
	moved     string
}

func (f *combinedRepo) serve(t *testing.T) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		defer f.mu.Unlock()
		p := strings.TrimPrefix(r.URL.Path, "/repos/owner/repo")
		switch {
		case p == "":
			writeBody(w, http.StatusOK, map[string]any{"full_name": "owner/repo", "default_branch": "main"})
		case p == "/pulls":
			writeBody(w, http.StatusOK, []map[string]any{photoPull})
		case p == "/commits":
			if r.URL.Query().Get("path") != dataRoot || r.URL.Query().Get("sha") != "head7" {
				t.Errorf("commits asked for %v", r.URL.Query())
			}
			writeBody(w, http.StatusOK, []map[string]any{{"commit": map[string]any{"message": f.message}}})
		case strings.HasPrefix(p, "/contents/"):
			f.list(w, strings.TrimPrefix(p, "/contents/"))
		case strings.HasPrefix(p, "/git/blobs/"):
			for _, content := range f.files {
				if blobSHA([]byte(content)) == strings.TrimPrefix(p, "/git/blobs/") {
					writeBody(w, http.StatusOK, map[string]any{"encoding": "base64", "content": base64.StdEncoding.EncodeToString([]byte(content))})
					return
				}
			}
			w.WriteHeader(http.StatusNotFound)
		case p == "/git/commits/head7":
			writeBody(w, http.StatusOK, map[string]any{"sha": "head7", "tree": map[string]any{"sha": "tree7"}})
		case p == "/git/trees" && r.Method == http.MethodPost:
			var in struct {
				Tree []map[string]string `json:"tree"`
			}
			_ = json.NewDecoder(r.Body).Decode(&in)
			f.committed = map[string]string{}
			for _, e := range in.Tree {
				f.committed[e["path"]] = e["content"]
			}
			writeBody(w, http.StatusCreated, map[string]any{"sha": "tree8"})
		case p == "/git/commits" && r.Method == http.MethodPost:
			var in map[string]any
			_ = json.NewDecoder(r.Body).Decode(&in)
			f.commitMsg, _ = in["message"].(string)
			writeBody(w, http.StatusCreated, map[string]any{"sha": "commit8", "html_url": "https://github.com/commit/8"})
		case p == "/git/refs/heads/photo-data/2026-10-15-024500" && r.Method == http.MethodPatch:
			var in map[string]any
			_ = json.NewDecoder(r.Body).Decode(&in)
			f.moved, _ = in["sha"].(string)
			writeBody(w, http.StatusOK, map[string]any{})
		default:
			t.Errorf("unexpected %s %s", r.Method, r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}
}

// list lists the files directly in folder, with their blob SHAs.
func (f *combinedRepo) list(w http.ResponseWriter, folder string) {
	listing := []map[string]any{}
	for file, content := range f.files {
		if dir, name, _ := strings.Cut(strings.TrimPrefix(file, folder+"/"), "/"); name == "" && strings.HasPrefix(file, folder+"/") {
			listing = append(listing, map[string]any{"name": dir, "path": file, "type": "file", "sha": blobSHA([]byte(content))})
		}
	}
	if len(listing) == 0 {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	writeBody(w, http.StatusOK, listing)
}

func newCombinedRepo(t *testing.T, files map[string]string) (*combinedRepo, *Client) {
	t.Helper()
	f := &combinedRepo{files: files}
	srv := httptest.NewServer(f.serve(t))
	t.Cleanup(srv.Close)
	return f, &Client{BaseURL: srv.URL, Client: srv.Client()}
}

func TestCommitCombined(t *testing.T) {
	gh := settings.GitHub{Repo: "owner/repo", Token: token}
	f, c := newCombinedRepo(t, map[string]string{
		dataRoot + "/photos/b.json":         `{"title": "B", "albums": ["x"]}`,
		dataRoot + "/photos/a.json":         `{"title":"A"}`,
		dataRoot + "/photos/notes.txt":      `not data`,
		dataRoot + "/photos/ALLPHOTOS.json": "[]\n",
		dataRoot + "/albums/x.json":         `{"id":"x","name":"X","description":""}`,
		dataRoot + "/albums/ALLALBUMS.json": "[\n  {\n    \"id\": \"x\",\n    \"name\": \"X\",\n    \"description\": \"\"\n  }\n]\n",
	})
	got, err := c.CommitCombined(t.Context(), gh, nil)
	if err != nil {
		t.Fatalf("CommitCombined() error = %v", err)
	}
	wantPhotos := "[\n  {\n    \"title\": \"A\"\n  },\n  {\n    \"title\": \"B\",\n    \"albums\": [\"x\"]\n  }\n]\n"
	// ALLALBUMS.json is already up to date; the tags, places and localizations folders aren't there, so
	// their combined files are made empty.
	want := map[string]string{
		dataRoot + "/photos/ALLPHOTOS.json":            wantPhotos,
		dataRoot + "/tags/ALLTAGS.json":                "[]\n",
		dataRoot + "/places/PLACES.json":               "[]\n",
		dataRoot + "/localizations/LOCALIZATIONS.json": "[]\n",
	}
	if !maps.Equal(f.committed, want) {
		t.Errorf("committed %q, want %q", f.committed, want)
	}
	if !got.Changed || got.CommitSHA != "commit8" || f.moved != "commit8" || len(got.Files) != 4 {
		t.Errorf("CommitCombined() = %+v, moved to %q; want commit8 with four files", got, f.moved)
	}
	if got.Counts["photos"] != 2 || got.Counts["albums"] != 1 || got.Counts["tags"] != 0 {
		t.Errorf("counts = %v, want 2 photos, 1 album, 0 tags", got.Counts)
	}
}

func TestCommitCombinedUpToDate(t *testing.T) {
	gh := settings.GitHub{Repo: "owner/repo", Token: token}
	f, c := newCombinedRepo(t, map[string]string{
		dataRoot + "/photos/a.json":                    `{"title":"A"}`,
		dataRoot + "/photos/ALLPHOTOS.json":            "[\n  {\n    \"title\": \"A\"\n  }\n]\n",
		dataRoot + "/albums/ALLALBUMS.json":            "[]\n",
		dataRoot + "/tags/ALLTAGS.json":                "[]\n",
		dataRoot + "/places/PLACES.json":               "[]\n",
		dataRoot + "/localizations/LOCALIZATIONS.json": "[]\n",
	})
	got, err := c.CommitCombined(t.Context(), gh, nil)
	if err != nil || got.Changed || f.committed != nil {
		t.Errorf("CommitCombined() = %+v, %v, committed %v; want nothing committed", got, err, f.committed)
	}
}

func TestCommitCombinedUnreadable(t *testing.T) {
	gh := settings.GitHub{Repo: "owner/repo", Token: token}
	f, c := newCombinedRepo(t, map[string]string{dataRoot + "/photos/a.json": `{"title":`})
	_, err := c.CommitCombined(t.Context(), gh, nil)
	var perr *PublishError
	if !errors.As(err, &perr) || !strings.Contains(perr.Message, "a.json") || f.committed != nil {
		t.Errorf("CommitCombined() error = %v, committed %v; want a.json named and nothing committed", err, f.committed)
	}
}

func TestCombinedStatus(t *testing.T) {
	gh := settings.GitHub{Repo: "owner/repo", Token: token}
	for _, tt := range []struct{ message, want string }{
		{CombineMessage, CombinedSynced},
		{CombineMessage + "\n\nCo-authored-by: someone", CombinedSynced},
		{"Add photo data apps/portfolio/src/data/photos/a.json", CombinedStale},
	} {
		f, c := newCombinedRepo(t, map[string]string{})
		f.message = tt.message
		got, err := c.CombinedStatus(t.Context(), gh)
		if err != nil || got.State != tt.want || got.HeadSHA != "head7" {
			t.Errorf("CombinedStatus() after %q = %+v, %v; want %s at head7", tt.message, got, err, tt.want)
		}
	}
}

func TestCommitCombinedWithEdits(t *testing.T) {
	gh := settings.GitHub{Repo: "owner/repo", Token: token}
	photo := "{\n  \"title\": \"A\",\n  \"socialMediaPublishDate\": null\n}\n"
	f, c := newCombinedRepo(t, map[string]string{
		dataRoot + "/photos/a.json":                    photo,
		dataRoot + "/photos/ALLPHOTOS.json":            "[\n  {\n    \"title\": \"A\",\n    \"socialMediaPublishDate\": null\n  }\n]\n",
		dataRoot + "/albums/ALLALBUMS.json":            "[]\n",
		dataRoot + "/tags/ALLTAGS.json":                "[]\n",
		dataRoot + "/places/PLACES.json":               "[]\n",
		dataRoot + "/localizations/LOCALIZATIONS.json": "[]\n",
	})
	edits := []FieldEdit{{Path: dataRoot + "/photos/a.json", Fields: map[string]json.RawMessage{"socialMediaPublishDate": json.RawMessage(`"2026-10-30"`)}}}
	got, err := c.CommitCombined(t.Context(), gh, edits)
	if err != nil {
		t.Fatalf("CommitCombined() error = %v", err)
	}
	wantPhoto := strings.Replace(photo, "null", `"2026-10-30"`, 1)
	wantAll := "[\n  {\n    \"title\": \"A\",\n    \"socialMediaPublishDate\": \"2026-10-30\"\n  }\n]\n"
	if f.committed[dataRoot+"/photos/a.json"] != wantPhoto || f.committed[dataRoot+"/photos/ALLPHOTOS.json"] != wantAll || len(f.committed) != 2 {
		t.Errorf("committed %q, want a.json and ALLPHOTOS.json with the new date", f.committed)
	}
	if got.Edited != 1 || len(got.Files) != 2 || !strings.HasPrefix(f.commitMsg, CombineMessage+"\n\n") {
		t.Errorf("CommitCombined() = %+v, message %q; want one edited file under the combine message", got, f.commitMsg)
	}
}

func TestCommitCombinedEditMissingFile(t *testing.T) {
	gh := settings.GitHub{Repo: "owner/repo", Token: token}
	f, c := newCombinedRepo(t, map[string]string{dataRoot + "/photos/a.json": `{"title":"A"}`})
	edits := []FieldEdit{{Path: dataRoot + "/photos/gone.json", Fields: map[string]json.RawMessage{"title": json.RawMessage(`"B"`)}}}
	_, err := c.CommitCombined(t.Context(), gh, edits)
	var perr *PublishError
	if !errors.As(err, &perr) || perr.Status != http.StatusNotFound || !strings.Contains(perr.Message, "gone.json") || f.committed != nil {
		t.Errorf("CommitCombined() error = %v, committed %v; want gone.json named and nothing committed", err, f.committed)
	}
}
