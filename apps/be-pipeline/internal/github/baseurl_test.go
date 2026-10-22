package github

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

const devURL = "https://pub-1234.r2.dev"

// photoA has every kind of image URL, written the way Publish writes them.
const photoA = `{
  "file": "DSC0001.jpg",
  "camera": "X-T5",
  "note": "https://pub-1234.r2.dev/not-an-image.webp",
  "images": {
    "full": "https://pub-1234.r2.dev/DSC0001.jpg",
    "key": "DSC0001.jpg",
    "xlarge": "https://pub-1234.r2.dev/DSC0001-xlarge.webp",
    "medium": null,
    "preview": "https://pub-1234.r2.dev/DSC0001-preview.webp",
    "thumbnail": "https://pub-1234.r2.dev/DSC0001-thumbnail.webp?crop=10,20,500&v=2",
    "thumbnailpreview": "https://pub-1234.r2.dev/DSC0001-thumbnailpreview.webp?crop=10,20,500",
    "other": ["https://pub-1234.r2.devious.com/x.webp", {"deep": "https://pub-1234.r2.dev"}]
  }
}
`

func TestImageStrings(t *testing.T) {
	leaves, err := imageStrings([]byte(photoA))
	if err != nil {
		t.Fatalf("imageStrings() error = %v", err)
	}
	var fields []string
	for _, l := range leaves {
		fields = append(fields, l.field)
		var v string
		if err := json.Unmarshal([]byte(photoA[l.start:l.end]), &v); err != nil || v != l.value {
			t.Errorf("%s: range %q doesn't hold %q", l.field, photoA[l.start:l.end], l.value)
		}
	}
	want := []string{
		"images.full", "images.key", "images.xlarge", "images.preview", "images.thumbnail",
		"images.thumbnailpreview", "images.other[0]", "images.other[1].deep",
	}
	if !reflect.DeepEqual(fields, want) {
		t.Errorf("fields = %v, want %v", fields, want)
	}
}

func TestRewrite(t *testing.T) {
	leaves, _ := imageStrings([]byte(photoA))
	got := string(rewrite([]byte(photoA), leaves, devURL, "https://photos.example.com"))
	want := strings.NewReplacer(
		`"https://pub-1234.r2.dev/DSC`, `"https://photos.example.com/DSC`,
		`{"deep": "https://pub-1234.r2.dev"}`, `{"deep": "https://photos.example.com"}`,
	).Replace(photoA)
	if !reflect.DeepEqual(got, want) {
		t.Errorf("rewrite() =\n%s\nwant\n%s", got, want)
	}
	if changes := rebaseAll(leaves, devURL, "https://photos.example.com"); len(changes) != 6 {
		t.Errorf("rebaseAll() = %d changes, want 6: %+v", len(changes), changes)
	}
}

func TestRewriteEscapedFrom(t *testing.T) {
	content := `{"images":{"full":"https:\/\/pub-1234.r2.dev\/a.jpg"}}`
	leaves, _ := imageStrings([]byte(content))
	got := string(rewrite([]byte(content), leaves, devURL, "https://cdn.example.com/photos"))
	if want := `{"images":{"full":"https://cdn.example.com/photos/a.jpg"}}`; got != want {
		t.Errorf("rewrite() = %s, want %s", got, want)
	}
}

func TestBaseURLPair(t *testing.T) {
	tests := []struct {
		from, to         string
		wantFrom, wantTo string
		wantErr          string
	}{
		{" https://pub-1234.r2.dev/ ", "https://photos.example.com//", devURL, "https://photos.example.com", ""},
		{devURL, "https://cdn.example.com/photos/", devURL, "https://cdn.example.com/photos", ""},
		{"pub-1234.r2.dev", "https://photos.example.com", "", "", "current base URL"},
		{devURL, "ftp://photos.example.com", "", "", "new base URL"},
		{devURL, "https://photos.example.com?x=1", "", "", "new base URL"},
		{devURL, "https://photos.example.com#x", "", "", "new base URL"},
		{devURL, devURL + "/", "", "", "same as the current"},
	}
	for _, tt := range tests {
		from, to, perr := baseURLPair(tt.from, tt.to, true)
		if tt.wantErr != "" {
			if perr == nil || !strings.Contains(perr.Message, tt.wantErr) {
				t.Errorf("baseURLPair(%q, %q) error = %v, want one containing %q", tt.from, tt.to, perr, tt.wantErr)
			}
			continue
		}
		if perr != nil || from != tt.wantFrom || to != tt.wantTo {
			t.Errorf("baseURLPair(%q, %q) = %q, %q, %v; want %q, %q", tt.from, tt.to, from, to, perr, tt.wantFrom, tt.wantTo)
		}
	}
	if from, to, perr := baseURLPair("", " ", false); from != "" || to != "" || perr != nil {
		t.Errorf("baseURLPair() with nothing = %q, %q, %v; want no change and no error", from, to, perr)
	}
}

// baseURLRepo is owner/repo with default branch main, an optional open photo
// data pull request, and photo files in apps/portfolio/src/data on each branch.
type baseURLRepo struct {
	mu        sync.Mutex
	pull      bool
	files     map[string]string // name → content, on the branch read
	tree      []map[string]string
	commit    map[string]any
	refs      map[string]string // created or moved ref → sha
	moveFails bool
	opened    map[string]string
}

func (f *baseURLRepo) start(t *testing.T) *Client {
	t.Helper()
	const dir = "apps/portfolio/src/data/photos"
	head := "main"
	if f.pull {
		head = "photo-data/2026-10-15-024500"
	}
	f.refs = map[string]string{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		defer f.mu.Unlock()
		p := strings.TrimPrefix(r.URL.Path, "/repos/owner/repo")
		switch {
		case r.Method == http.MethodGet && p == "":
			writeBody(w, http.StatusOK, map[string]any{"full_name": "owner/repo", "default_branch": "main"})
		case r.Method == http.MethodGet && p == "/pulls":
			pulls := []map[string]any{}
			if f.pull {
				pulls = append(pulls, map[string]any{
					"number": 7, "html_url": "https://github.com/owner/repo/pull/7",
					"head": map[string]any{"ref": head, "repo": map[string]any{"full_name": "owner/repo"}},
				})
			}
			writeBody(w, http.StatusOK, pulls)
		case r.Method == http.MethodGet && p == "/git/ref/heads/"+head:
			writeBody(w, http.StatusOK, map[string]any{"object": map[string]any{"sha": "head1"}})
		case r.Method == http.MethodGet && p == "/contents/"+dir:
			if r.URL.Query().Get("ref") != "head1" {
				t.Errorf("listed at ref %q, want the branch's head", r.URL.Query().Get("ref"))
			}
			entries := []map[string]any{
				{"name": "ALLPHOTOS.json", "path": dir + "/ALLPHOTOS.json", "type": "file", "sha": "all"},
				{"name": "dummy.json", "path": dir + "/dummy.json", "type": "file", "sha": "dummy"},
				{"name": "README.md", "path": dir + "/README.md", "type": "file", "sha": "readme"},
				{"name": "sub", "path": dir + "/sub", "type": "dir", "sha": "sub"},
			}
			for name := range f.files {
				entries = append(entries, map[string]any{
					"name": name, "path": dir + "/" + name, "type": "file", "sha": name,
					"html_url": "https://github.com/owner/repo/blob/" + head + "/" + dir + "/" + name,
				})
			}
			writeBody(w, http.StatusOK, entries)
		case r.Method == http.MethodGet && strings.HasPrefix(p, "/git/blobs/"):
			content, ok := f.files[strings.TrimPrefix(p, "/git/blobs/")]
			if !ok {
				t.Errorf("read blob %s, want photo files only", p)
			}
			writeBody(w, http.StatusOK, map[string]any{
				"encoding": "base64", "content": base64.StdEncoding.EncodeToString([]byte(content)),
			})
		case r.Method == http.MethodGet && p == "/git/commits/head1":
			writeBody(w, http.StatusOK, map[string]any{"sha": "head1", "tree": map[string]any{"sha": "tree1"}})
		case r.Method == http.MethodPost && p == "/git/trees":
			var in struct {
				BaseTree string              `json:"base_tree"`
				Tree     []map[string]string `json:"tree"`
			}
			_ = json.NewDecoder(r.Body).Decode(&in)
			if in.BaseTree != "tree1" {
				t.Errorf("base_tree = %q, want tree1", in.BaseTree)
			}
			f.tree = in.Tree
			writeBody(w, http.StatusCreated, map[string]any{"sha": "tree2"})
		case r.Method == http.MethodPost && p == "/git/commits":
			_ = json.NewDecoder(r.Body).Decode(&f.commit)
			writeBody(w, http.StatusCreated, map[string]any{"sha": "commit2", "html_url": "https://github.com/owner/repo/commit/commit2"})
		case r.Method == http.MethodPatch && strings.HasPrefix(p, "/git/refs/heads/"):
			if f.moveFails {
				w.WriteHeader(http.StatusUnprocessableEntity)
				return
			}
			var in map[string]any
			_ = json.NewDecoder(r.Body).Decode(&in)
			f.refs[strings.TrimPrefix(p, "/git/refs/heads/")] = in["sha"].(string)
			writeBody(w, http.StatusOK, map[string]any{})
		case r.Method == http.MethodPost && p == "/git/refs":
			var in map[string]string
			_ = json.NewDecoder(r.Body).Decode(&in)
			f.refs[strings.TrimPrefix(in["ref"], "refs/heads/")] = in["sha"]
			writeBody(w, http.StatusCreated, map[string]any{})
		case r.Method == http.MethodPost && p == "/pulls":
			_ = json.NewDecoder(r.Body).Decode(&f.opened)
			writeBody(w, http.StatusCreated, map[string]any{"number": 8, "html_url": "https://github.com/owner/repo/pull/8"})
		default:
			t.Errorf("unexpected %s %s", r.Method, r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	now := time.Date(2026, 10, 22, 1, 2, 3, 0, time.UTC)
	return &Client{BaseURL: srv.URL, Client: srv.Client(), Now: func() time.Time { return now }}
}

var baseURLSettings = settings.GitHub{Repo: "owner/repo", Token: token}

func TestPreviewBaseURL(t *testing.T) {
	repo := &baseURLRepo{pull: true, files: map[string]string{
		"DSC0001.json": photoA,
		"DSC0002.json": `{"file":"DSC0002.jpg","images":{"full":"https://photos.example.com/DSC0002.jpg"}}`,
		"broken.json":  `{"file":`,
	}}
	got, err := repo.start(t).PreviewBaseURL(t.Context(), baseURLSettings, devURL+"/", "https://photos.example.com")
	if err != nil {
		t.Fatalf("PreviewBaseURL() error = %v", err)
	}
	if got.Branch != "photo-data/2026-10-15-024500" || got.PullRequest == nil || got.PullRequest.Number != 7 {
		t.Errorf("read %q with pull request %+v, want the photo data pull request's branch", got.Branch, got.PullRequest)
	}
	if got.From != devURL || got.PhotoFiles != 2 || got.URLs != 6 || len(got.Files) != 1 {
		t.Errorf("preview = from %q, %d photo files, %d URLs in %d files; want %q, 2, 6 in 1", got.From, got.PhotoFiles, got.URLs, len(got.Files), devURL)
	}
	wantOrigins := []ImageOrigin{
		{Origin: devURL, URLs: 6, Files: 1},
		{Origin: "https://photos.example.com", URLs: 1, Files: 1},
		{Origin: "https://pub-1234.r2.devious.com", URLs: 1, Files: 1},
	}
	if !reflect.DeepEqual(got.Origins, wantOrigins) {
		t.Errorf("origins = %+v, want %+v", got.Origins, wantOrigins)
	}
	if len(got.Unreadable) != 1 || got.Unreadable[0].Path != "apps/portfolio/src/data/photos/broken.json" {
		t.Errorf("unreadable = %+v, want broken.json", got.Unreadable)
	}
	first := got.Files[0].Changes[0]
	if first != (URLChange{Field: "images.full", From: devURL + "/DSC0001.jpg", To: "https://photos.example.com/DSC0001.jpg"}) {
		t.Errorf("first change = %+v", first)
	}
}

func TestPreviewBaseURLOriginsOnly(t *testing.T) {
	repo := &baseURLRepo{files: map[string]string{"DSC0001.json": photoA}}
	got, err := repo.start(t).PreviewBaseURL(t.Context(), baseURLSettings, "", "")
	if err != nil {
		t.Fatalf("PreviewBaseURL() error = %v", err)
	}
	if got.Branch != "main" || got.PullRequest != nil || len(got.Files) != 0 || len(got.Origins) != 2 {
		t.Errorf("preview = %+v, want origins on main and no changes", got)
	}
}

func TestReplaceBaseURLOnOpenPullRequest(t *testing.T) {
	repo := &baseURLRepo{pull: true, files: map[string]string{
		"DSC0001.json": photoA,
		"DSC0002.json": `{"file":"DSC0002.jpg","images":{"full":"https://photos.example.com/DSC0002.jpg"}}`,
	}}
	got, err := repo.start(t).ReplaceBaseURL(t.Context(), baseURLSettings, devURL, "https://photos.example.com")
	if err != nil {
		t.Fatalf("ReplaceBaseURL() error = %v", err)
	}
	want := BaseURLResult{
		Branch: "photo-data/2026-10-15-024500", CommitSHA: "commit2", CommitURL: "https://github.com/owner/repo/commit/commit2",
		PullRequestURL: "https://github.com/owner/repo/pull/7", PullRequestNumber: 7, Files: 1, URLs: 6,
	}
	changes := got.Changes
	got.Changes = nil
	if !reflect.DeepEqual(got, want) {
		t.Errorf("ReplaceBaseURL() = %+v, want %+v", got, want)
	}
	if len(repo.tree) != 1 || repo.tree[0]["path"] != "apps/portfolio/src/data/photos/DSC0001.json" || repo.tree[0]["mode"] != "100644" {
		t.Fatalf("tree = %v, want DSC0001.json only", repo.tree)
	}
	if len(changes) != 1 || changes[0].Path != repo.tree[0]["path"] || string(changes[0].Before) != photoA ||
		string(changes[0].After) != repo.tree[0]["content"] {
		t.Errorf("changes = %+v, want DSC0001.json before and after", changes)
	}
	if strings.Contains(repo.tree[0]["content"], `"https://pub-1234.r2.dev/DSC`) || !strings.Contains(repo.tree[0]["content"], `"note": "https://pub-1234.r2.dev/not-an-image.webp"`) {
		t.Errorf("content = %s, want only the image URLs moved", repo.tree[0]["content"])
	}
	if parents := repo.commit["parents"].([]any); len(parents) != 1 || parents[0] != "head1" {
		t.Errorf("commit parents = %v, want the branch's head", parents)
	}
	if repo.refs["photo-data/2026-10-15-024500"] != "commit2" || repo.opened != nil {
		t.Errorf("refs %v, opened %v; want the branch moved and no new pull request", repo.refs, repo.opened)
	}
}

func TestReplaceBaseURLOpensPullRequest(t *testing.T) {
	repo := &baseURLRepo{files: map[string]string{"DSC0001.json": photoA}}
	got, err := repo.start(t).ReplaceBaseURL(t.Context(), baseURLSettings, devURL, "https://photos.example.com")
	if err != nil {
		t.Fatalf("ReplaceBaseURL() error = %v", err)
	}
	const branch = "photo-data/2026-10-22-010203"
	if got.Branch != branch || !got.NewPullRequest || got.PullRequestNumber != 8 {
		t.Errorf("ReplaceBaseURL() = %+v, want a new pull request from %s", got, branch)
	}
	if repo.refs[branch] != "commit2" || repo.opened["head"] != branch || repo.opened["base"] != "main" || repo.opened["title"] != PullRequestTitle {
		t.Errorf("refs %v, opened %v; want a new branch at the commit and a pull request into main", repo.refs, repo.opened)
	}
}

func TestReplaceBaseURLErrors(t *testing.T) {
	tests := []struct {
		name      string
		files     map[string]string
		moveFails bool
		to        string
		want      string
	}{
		{"nothing to change", map[string]string{"a.json": `{"images":{"full":"https://photos.example.com/a.jpg"}}`}, false, "https://photos.example.com", "nothing to change"},
		{"unreadable file", map[string]string{"a.json": photoA, "b.json": `[]`}, false, "https://photos.example.com", "b.json couldn't be read"},
		{"branch moved", map[string]string{"a.json": photoA}, true, "https://photos.example.com", "changed while"},
		{"missing new URL", map[string]string{"a.json": photoA}, false, "", "new base URL"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &baseURLRepo{pull: true, files: tt.files, moveFails: tt.moveFails}
			_, err := repo.start(t).ReplaceBaseURL(t.Context(), baseURLSettings, devURL, tt.to)
			var perr *PublishError
			if !errors.As(err, &perr) || !strings.Contains(perr.Message, tt.want) {
				t.Errorf("ReplaceBaseURL() error = %v, want one containing %q", err, tt.want)
			}
		})
	}
}
