package github

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

func TestRemove(t *testing.T) {
	const file = photosDir + "DSC0001.json"
	content := `{"file":"DSC0001.jpg","images":{"full":"https://pub/photos/a-dsc0001.jpg","key":"photos/a-dsc0001.jpg"}}`
	f, c := newFakeGitHub(t)
	f.openPull(prBranch, map[string]string{file: content})
	got, err := c.Remove(t.Context(), pullGH, file)
	if err != nil {
		t.Fatalf("Remove() error = %v", err)
	}
	want := RemovedFile{
		Path: file, PhotoName: "DSC0001.jpg", ImageURL: "https://pub/photos/a-dsc0001.jpg", ImageKey: "photos/a-dsc0001.jpg",
		Before: json.RawMessage(content),
	}
	if got.Path != want.Path || got.PhotoName != want.PhotoName || got.ImageKey != want.ImageKey || string(got.Before) != content {
		t.Errorf("Remove() = %+v, want %+v", got, want)
	}
	if staged, ok := stagedContent(t, c, file); !ok || !staged.Deleted {
		t.Errorf("pending = %+v, want the file deleted", staged)
	}
	if w := f.writes(); len(w) != 0 {
		t.Errorf("Remove() wrote to GitHub: %v", w)
	}
}

func TestRemovePendingPhotoDropsIt(t *testing.T) {
	_, c := newFakeGitHub(t)
	saved, err := c.Publish(t.Context(), pullGH, photo("DSC0001"))
	if err != nil {
		t.Fatalf("Publish() error = %v", err)
	}
	if _, err := c.Remove(t.Context(), pullGH, saved.Path); err != nil {
		t.Fatalf("Remove() error = %v", err)
	}
	if _, ok := stagedContent(t, c, saved.Path); ok {
		t.Error("the removed photo is still pending")
	}
}

func TestRemoveErrors(t *testing.T) {
	const file = photosDir + "DSC0001.json"
	tests := []struct {
		name string
		file string
		want string
	}{
		{"outside the folder", "README.json", "Only photo JSON files"},
		{"ALLPHOTOS.json", photosDir + "ALLPHOTOS.json", "Only photo JSON files"},
		{"not in the pull request", photosDir + "other.json", "isn't in the photo data pull request"},
		{"already merged", photosDir + "merged.json", "Only new files can be removed"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f, c := newFakeGitHub(t)
			f.files["main:"+photosDir+"merged.json"] = "{}"
			f.openPull(prBranch, map[string]string{file: "{}"})
			_, err := c.Remove(t.Context(), pullGH, tt.file)
			var perr *PublishError
			if !errors.As(err, &perr) || !strings.Contains(perr.Message, tt.want) {
				t.Errorf("Remove() error = %v, want one containing %q", err, tt.want)
			}
		})
	}
}
