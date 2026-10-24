package github

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/colors"
)

// coloredPhoto is a photo file that already has colors.
const coloredPhoto = `{
  "file": "DSC0002.jpg",
  "images": {
    "key": "photos/ab-DSC0002.jpg"
  },
  "colors": {
    "lightness": 10
  }
}
`

// colorReader reads every photo as red, except failKey, and records the keys read.
func colorReader(failKey string, keys *[]string) ColorReader {
	return func(_ context.Context, key string) (colors.Summary, string) {
		*keys = append(*keys, key)
		if key == failKey {
			return colors.Summary{}, "That photo isn't in the bucket anymore."
		}
		return colors.Summary{Average: colors.Color{Hex: "#ff0000"}, Lightness: 54}, ""
	}
}

func TestPreviewColors(t *testing.T) {
	repo := &baseURLRepo{pull: true, files: map[string]string{
		"DSC0001.json": oldPhoto,
		"DSC0002.json": coloredPhoto,
		"DSC0003.json": `{"file":"DSC0003.jpg","colors":null}`,
	}}
	var keys []string
	got, err := repo.start(t).PreviewColors(t.Context(), baseURLSettings, colorReader("", &keys), false)
	if err != nil {
		t.Fatalf("PreviewColors() error = %v", err)
	}
	if got.PhotoFiles != 3 || got.HaveColors != 1 || len(got.Files) != 2 {
		t.Fatalf("preview = %+v, want 2 of 3 files without colors", got)
	}
	if first := got.Files[0]; first.Colors == nil || first.Colors.Average.Hex != "#ff0000" || first.Replaces {
		t.Errorf("first file = %+v, want red", first)
	}
	if second := got.Files[1]; second.Colors != nil || !strings.Contains(second.Error, "images.key") {
		t.Errorf("second file = %+v, want an error for the missing key", second)
	}
	if len(keys) != 1 || keys[0] != "photos/ab-DSC0001.jpg" {
		t.Errorf("read %v, want only DSC0001's original", keys)
	}
}

func TestPreviewColorsRecompute(t *testing.T) {
	repo := &baseURLRepo{files: map[string]string{"DSC0002.json": coloredPhoto}}
	var keys []string
	got, err := repo.start(t).PreviewColors(t.Context(), baseURLSettings, colorReader("", &keys), true)
	if err != nil {
		t.Fatalf("PreviewColors() error = %v", err)
	}
	if len(got.Files) != 1 || !got.Files[0].Replaces || !got.Recompute {
		t.Errorf("files = %+v, want DSC0002 recomputed", got.Files)
	}
}

func TestWriteColors(t *testing.T) {
	repo := &baseURLRepo{pull: true, files: map[string]string{
		"DSC0001.json": oldPhoto,
		"DSC0002.json": coloredPhoto,
		"DSC0004.json": `{"file":"DSC0004.jpg","images":{"key":"photos/ab-DSC0004.jpg"}}`,
	}}
	var keys []string
	got, err := repo.start(t).WriteColors(t.Context(), baseURLSettings, colorReader("photos/ab-DSC0004.jpg", &keys), false)
	if err != nil {
		t.Fatalf("WriteColors() error = %v", err)
	}
	if got.Files != 1 || got.Failed != 1 {
		t.Errorf("WriteColors() = %+v, want 1 saved and 1 failed", got)
	}
	staged := repo.staged(t)
	content, ok := staged[photosDir+"DSC0001.json"]
	if len(staged) != 1 || !ok {
		t.Fatalf("pending = %v, want DSC0001.json only", staged)
	}
	if !strings.HasPrefix(content, oldPhoto[:strings.LastIndex(oldPhoto, "}")-2]) ||
		!strings.Contains(content, `"colors": {`) || !strings.Contains(content, `"hex": "#ff0000"`) {
		t.Errorf("content = %s, want the old file with colors added", content)
	}
}

func TestWriteColorsNothingToAdd(t *testing.T) {
	repo := &baseURLRepo{pull: true, files: map[string]string{"DSC0002.json": coloredPhoto}}
	var keys []string
	_, err := repo.start(t).WriteColors(t.Context(), baseURLSettings, colorReader("", &keys), false)
	var perr *PublishError
	if !errors.As(err, &perr) || !strings.Contains(perr.Message, "nothing to add") {
		t.Errorf("WriteColors() error = %v, want nothing to add", err)
	}
}
