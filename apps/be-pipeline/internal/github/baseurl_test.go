package github

import (
	"encoding/json"
	"errors"
	"reflect"
	"strings"
	"testing"

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

// baseURLRepo is owner/repo on a fake GitHub, with files as photo files in
// apps/portfolio/src/data/photos: on the photo data pull request's branch
// when pull is set, or else on main.
type baseURLRepo struct {
	pull  bool
	files map[string]string // name → content
	f     *fakeGitHub
	c     *Client
}

func (r *baseURLRepo) start(t *testing.T) *Client {
	t.Helper()
	r.f, r.c = newFakeGitHub(t)
	files := map[string]string{
		photosDir + "ALLPHOTOS.json": "[]\n",
		photosDir + "README.md":      "hi",
		photosDir + "sub/x.json":     "{}",
	}
	for name, content := range r.files {
		files[photosDir+name] = content
	}
	if r.pull {
		r.f.openPull(prBranch, files)
		return r.c
	}
	for p, content := range files {
		r.f.files["main:"+p] = content
	}
	return r.c
}

// staged is every pending file's content, by path, and fails the test when
// anything was written to GitHub.
func (r *baseURLRepo) staged(t *testing.T) map[string]string {
	t.Helper()
	if w := r.f.writes(); len(w) != 0 {
		t.Errorf("wrote to GitHub: %v", w)
	}
	files, err := r.c.stage().files(target{owner: "owner", name: "repo"})
	if err != nil {
		t.Fatal(err)
	}
	out := map[string]string{}
	for p, f := range files {
		out[p] = f.Content
	}
	return out
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
	if got.Branch != prBranch || got.PullRequest == nil || got.PullRequest.Number != 1 {
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
	if len(got.Unreadable) != 1 || got.Unreadable[0].Path != photosDir+"broken.json" {
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
	if got.Branch != prBranch || got.PullRequestNumber != 1 || got.Files != 1 || got.URLs != 6 {
		t.Errorf("ReplaceBaseURL() = %+v, want 6 URLs in 1 file, for pull request 1", got)
	}
	staged := repo.staged(t)
	file := photosDir + "DSC0001.json"
	content, ok := staged[file]
	if len(staged) != 1 || !ok {
		t.Fatalf("pending = %v, want DSC0001.json only", staged)
	}
	if len(got.Changes) != 1 || got.Changes[0].Path != file || string(got.Changes[0].Before) != photoA ||
		string(got.Changes[0].After) != content {
		t.Errorf("changes = %+v, want DSC0001.json before and after", got.Changes)
	}
	if strings.Contains(content, `"https://pub-1234.r2.dev/DSC`) || !strings.Contains(content, `"note": "https://pub-1234.r2.dev/not-an-image.webp"`) {
		t.Errorf("content = %s, want only the image URLs moved", content)
	}
}

func TestReplaceBaseURLWithoutPullRequest(t *testing.T) {
	repo := &baseURLRepo{files: map[string]string{"DSC0001.json": photoA}}
	got, err := repo.start(t).ReplaceBaseURL(t.Context(), baseURLSettings, devURL, "https://photos.example.com")
	if err != nil {
		t.Fatalf("ReplaceBaseURL() error = %v", err)
	}
	if got.Branch != "" || got.PullRequestNumber != 0 || got.Files != 1 {
		t.Errorf("ReplaceBaseURL() = %+v, want it pending for the pull request Commit opens", got)
	}
	if staged := repo.staged(t); len(staged) != 1 {
		t.Errorf("pending = %v, want DSC0001.json", staged)
	}
}

func TestReplaceBaseURLErrors(t *testing.T) {
	tests := []struct {
		name  string
		files map[string]string
		to    string
		want  string
	}{
		{"nothing to change", map[string]string{"a.json": `{"images":{"full":"https://photos.example.com/a.jpg"}}`}, "https://photos.example.com", "nothing to change"},
		{"unreadable file", map[string]string{"a.json": photoA, "b.json": `[]`}, "https://photos.example.com", "b.json couldn't be read"},
		{"missing new URL", map[string]string{"a.json": photoA}, "", "new base URL"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &baseURLRepo{pull: true, files: tt.files}
			_, err := repo.start(t).ReplaceBaseURL(t.Context(), baseURLSettings, devURL, tt.to)
			var perr *PublishError
			if !errors.As(err, &perr) || !strings.Contains(perr.Message, tt.want) {
				t.Errorf("ReplaceBaseURL() error = %v, want one containing %q", err, tt.want)
			}
			if staged := repo.staged(t); len(staged) != 0 {
				t.Errorf("pending = %v, want nothing", staged)
			}
		})
	}
}
