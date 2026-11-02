package github

import (
	"context"
	"errors"
	"slices"
	"strings"
	"sync"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// titledPhotoJSON writes a photo file titled title (null when "") whose image is
// photos/<hash>-<stem>.jpg on the CDN, with two versions and the key.
func titledPhotoJSON(title, hash, stem string) string {
	t := "null"
	if title != "" {
		t = `"` + title + `"`
	}
	base := "photos/" + hash + "-" + stem
	return `{
  "title": ` + t + `,
  "file": "DSC.jpg",
  "images": {
    "full": "https://cdn.example.com/` + base + `.jpg",
    "key": "` + base + `.jpg",
    "large": "https://cdn.example.com/` + base + `-large.webp",
    "thumbnail": "https://cdn.example.com/` + base + `-thumbnail.webp?crop=0,0,10"
  }
}
`
}

func TestPreviewImageNames(t *testing.T) {
	repo := &baseURLRepo{pull: true, files: map[string]string{
		// a keeps its name; b has the same title, so it gets -2, as c's
		// name is in the bucket under another photo.
		"a.json": titledPhotoJSON("Amsterdam Canal", "aaaaaaaaaaaa", "amsterdam-canal"),
		"b.json": titledPhotoJSON("Amsterdam Canal", "bbbbbbbbbbbb", "dsc0001"),
		"c.json": titledPhotoJSON("Tokyo Tower", "cccccccccccc", "dsc0001"),
		"d.json": titledPhotoJSON("", "dddddddddddd", "dsc0002"),
		"e.json": `{"title":"Elsewhere","images":{"full":"https://example.com/e.jpg"}}`,
		"f.json": `{"title":`,
	}}
	bucket := []string{"photos/999999999999-tokyo-tower.jpg", "photos/999999999999-tokyo-tower-large.webp"}
	got, err := repo.start(t).PreviewImageNames(t.Context(), baseURLSettings, bucket)
	if err != nil {
		t.Fatalf("PreviewImageNames() error = %v", err)
	}
	if got.PhotoFiles != 5 || got.Named != 1 || got.Untitled != 1 || got.Elsewhere != 1 || len(got.Unreadable) != 1 {
		t.Errorf("preview = %d files, %d named, %d untitled, %d elsewhere, %d unreadable; want 5, 1, 1, 1, 1",
			got.PhotoFiles, got.Named, got.Untitled, got.Elsewhere, len(got.Unreadable))
	}
	var renames []string
	for _, f := range got.Files {
		renames = append(renames, strings.TrimPrefix(f.Path, photosDir)+" "+f.From+" → "+f.To)
	}
	want := []string{
		"b.json photos/bbbbbbbbbbbb-dsc0001.jpg → photos/bbbbbbbbbbbb-amsterdam-canal-2.jpg",
		"c.json photos/cccccccccccc-dsc0001.jpg → photos/cccccccccccc-tokyo-tower-2.jpg",
	}
	if !slices.Equal(renames, want) {
		t.Errorf("renames = %q, want %q", renames, want)
	}
	if len(got.Files) > 0 && len(got.Files[0].Changes) != 4 {
		t.Errorf("b.json changes = %+v, want the full URL, key, large and thumbnail", got.Files[0].Changes)
	}
}

func TestPreviewImageNamesKeepsGivenSuffix(t *testing.T) {
	repo := &baseURLRepo{files: map[string]string{
		"a.json": titledPhotoJSON("Canal", "aaaaaaaaaaaa", "canal-2"),
		"b.json": titledPhotoJSON("Canal", "bbbbbbbbbbbb", "canal"),
	}}
	got, err := repo.start(t).PreviewImageNames(t.Context(), baseURLSettings, nil)
	if err != nil {
		t.Fatalf("PreviewImageNames() error = %v", err)
	}
	if got.Named != 2 || len(got.Files) != 0 {
		t.Errorf("preview = %d named, files %+v; want both named already", got.Named, got.Files)
	}
}

func TestRenameImages(t *testing.T) {
	photo := titledPhotoJSON("Amsterdam Canal", "bbbbbbbbbbbb", "dsc0001")
	repo := &baseURLRepo{pull: true, files: map[string]string{"b.json": photo}}
	var mu sync.Mutex
	var copies []string
	copier := func(_ context.Context, from, to string) string {
		mu.Lock()
		defer mu.Unlock()
		copies = append(copies, from+" → "+to)
		return ""
	}
	got, err := repo.start(t).RenameImages(t.Context(), baseURLSettings, nil, copier)
	if err != nil {
		t.Fatalf("RenameImages() error = %v", err)
	}
	if got.Files != 1 || got.Fields != 4 || got.PullRequestNumber != 1 {
		t.Errorf("RenameImages() = %+v, want 4 fields in 1 file", got)
	}
	if want := []string{"photos/bbbbbbbbbbbb-dsc0001.jpg → photos/bbbbbbbbbbbb-amsterdam-canal.jpg"}; !slices.Equal(copies, want) {
		t.Errorf("copies = %q, want %q", copies, want)
	}
	content := repo.staged(t)[photosDir+"b.json"]
	if want := strings.ReplaceAll(photo, "bbbbbbbbbbbb-dsc0001", "bbbbbbbbbbbb-amsterdam-canal"); content != want {
		t.Errorf("content =\n%s\nwant\n%s", content, want)
	}
}

func TestRenameImagesErrors(t *testing.T) {
	ok := func(context.Context, string, string) string { return "" }
	failing := func(context.Context, string, string) string { return "no access" }
	tests := []struct {
		name   string
		files  map[string]string
		copier ImageCopier
		want   string
	}{
		{"nothing to rename", map[string]string{"a.json": titledPhotoJSON("Canal", "aaaaaaaaaaaa", "canal")}, ok, "nothing to rename"},
		{"unreadable file", map[string]string{"a.json": titledPhotoJSON("Canal", "aaaaaaaaaaaa", "x"), "b.json": `[]`}, ok, "b.json couldn't be read"},
		{"copy fails", map[string]string{"a.json": titledPhotoJSON("Canal", "aaaaaaaaaaaa", "x")}, failing, "no access"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &baseURLRepo{pull: true, files: tt.files}
			_, err := repo.start(t).RenameImages(t.Context(), baseURLSettings, nil, tt.copier)
			var perr *PublishError
			if !errors.As(err, &perr) || !strings.Contains(perr.Message, tt.want) {
				t.Errorf("RenameImages() error = %v, want one containing %q", err, tt.want)
			}
			if staged := repo.staged(t); len(staged) != 0 {
				t.Errorf("pending = %v, want nothing", staged)
			}
		})
	}
}

func TestRenamedImage(t *testing.T) {
	from := mustKey(t, "photos/aaaaaaaaaaaa-dsc0001.jpg")
	to := mustKey(t, "photos/aaaaaaaaaaaa-canal.jpg")
	tests := map[string]string{
		"photos/aaaaaaaaaaaa-dsc0001.jpg":                                               "photos/aaaaaaaaaaaa-canal.jpg",
		"https://cdn.example.com/photos/aaaaaaaaaaaa-dsc0001-xsmall.webp":               "https://cdn.example.com/photos/aaaaaaaaaaaa-canal-xsmall.webp",
		"https://cdn.example.com/photos/aaaaaaaaaaaa-dsc0001-thumbnail.webp?crop=1,2,3": "https://cdn.example.com/photos/aaaaaaaaaaaa-canal-thumbnail.webp?crop=1,2,3",
		"https://cdn.example.com/photos/aaaaaaaaaaaa-dsc0001-2.jpg":                     "",
		"https://cdn.example.com/xphotos/aaaaaaaaaaaa-dsc0001.jpg":                      "",
	}
	for u, want := range tests {
		got, ok := renamedImage(u, from, to)
		if got != want || ok != (want != "") {
			t.Errorf("renamedImage(%q) = %q, %v; want %q", u, got, ok, want)
		}
	}
}

func TestNamedAfter(t *testing.T) {
	tests := map[string]bool{"canal": true, "canal-2": true, "canal-12": true, "canal-02": false, "canal-x": false, "canals": false}
	for stem, want := range tests {
		if got := namedAfter(stem, "canal"); got != want {
			t.Errorf("namedAfter(%q) = %v, want %v", stem, got, want)
		}
	}
}

func mustKey(t *testing.T, key string) storage.PhotoKey {
	t.Helper()
	k, ok := storage.ParsePhotoKey(key)
	if !ok {
		t.Fatalf("ParsePhotoKey(%q) failed", key)
	}
	return k
}
