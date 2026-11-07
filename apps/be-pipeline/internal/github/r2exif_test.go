package github

import (
	"context"
	"encoding/json"
	"strings"
	"sync"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/exif"
)

// fixedPhoto is a photo file whose time was fixed by Times across timezones
// and whose lens a camera override renamed.
const fixedPhoto = `{
  "title": "Night Market",
  "file": "DSC0001.jpg",
  "createDate": "2016:12:23 22:07:39",
  "customCreateDate": "2016:12:24 06:07:39",
  "lens": "Color Skopar 21mm",
  "city": "Seoul",
  "customCity": null,
  "images": {
    "key": "photos/ab-DSC0001.jpg",
    "thumbnail": "https://cdn.example.com/photos/ab-DSC0001-thumbnail.webp"
  },
  "exifOriginals": {
    "lens": "21.0 mm"
  }
}
`

// matchingPhoto is a photo file its original's EXIF matches.
const matchingPhoto = `{"file":"DSC0002.jpg","createDate":"2016:12:23 22:07:39","city":"Seoul","images":{"key":"photos/ab-DSC0002.jpg"}}`

// r2Exif reads every original as taken at 2016:12:23 22:07:39 in Seoul with a
// "21.0 mm" lens, except failKey, and records the keys read.
func r2Exif(failKey string, keys *[]string) ExifReader {
	var mu sync.Mutex
	return func(_ context.Context, key string) (exif.Sanitized, string) {
		mu.Lock()
		*keys = append(*keys, key)
		mu.Unlock()
		if key == failKey {
			return exif.Sanitized{}, "That photo isn't in the bucket anymore."
		}
		date, city, lens := "2016:12:23 22:07:39", "Seoul", "21.0 mm"
		return exif.Sanitized{CreateDate: &date, City: &city, Lens: &lens}, ""
	}
}

func TestPreviewR2Exif(t *testing.T) {
	repo := &baseURLRepo{pull: true, files: map[string]string{
		"DSC0001.json": fixedPhoto,
		"DSC0002.json": matchingPhoto,
		"DSC0003.json": `{"file":"DSC0003.jpg","images":{"key":"photos/ab-DSC0003.jpg"}}`,
		"DSC0004.json": `{"file":"DSC0004.jpg"}`,
	}}
	var keys []string
	got, err := repo.start(t).PreviewR2Exif(t.Context(), baseURLSettings, r2Exif("photos/ab-DSC0003.jpg", &keys))
	if err != nil {
		t.Fatalf("PreviewR2Exif() error = %v", err)
	}
	if got.PhotoFiles != 4 || got.Checked != 3 || len(keys) != 3 {
		t.Errorf("preview = %+v, read %v; want 3 of 4 originals read", got, keys)
	}
	if len(got.Photos) != 2 {
		t.Fatalf("photos = %+v, want DSC0001's mismatches and DSC0003's error", got.Photos)
	}
	first := got.Photos[0]
	want := []R2ExifMismatch{
		{Field: "createDate", Photo: "2016:12:24 06:07:39", R2: ptr("2016:12:23 22:07:39"), Source: "custom"},
		{Field: "lens", Photo: "Color Skopar 21mm", R2: ptr("21.0 mm"), Source: "override"},
	}
	if first.Title != "Night Market" || !sameMismatches(first.Mismatches, want) {
		t.Errorf("first = %+v, want %+v", first, want)
	}
	if second := got.Photos[1]; !strings.Contains(second.Error, "isn't in the bucket") {
		t.Errorf("second = %+v, want the read's error", second)
	}
}

func sameMismatches(a, b []R2ExifMismatch) bool {
	x, _ := json.Marshal(a)
	y, _ := json.Marshal(b)
	return string(x) == string(y)
}

func TestRecordR2ExifEdit(t *testing.T) {
	repo := &baseURLRepo{pull: true, files: map[string]string{"DSC0001.json": fixedPhoto}}
	c := repo.start(t)
	path := photosDir + "DSC0001.json"
	fields := []R2ExifFieldEdit{{Field: "createDate", From: ptr("2016:12:23 22:07:39"), To: "2016:12:24 06:07:39"}}

	got, err := c.RecordR2ExifEdit(t.Context(), baseURLSettings, path, "photos/ab-DSC0001.jpg", fields)
	if err != nil {
		t.Fatalf("RecordR2ExifEdit() error = %v", err)
	}
	if len(got.Edits) != 1 || got.Edits[0].Date == "" {
		t.Fatalf("edits = %+v, want one dated edit", got.Edits)
	}
	content := repo.staged(t)[path]
	if !strings.HasPrefix(content, fixedPhoto[:strings.LastIndex(fixedPhoto, "}")-2]) ||
		!strings.Contains(content, `"r2ExifEdits": [`) || !strings.Contains(content, `"to": "2016:12:24 06:07:39"`) {
		t.Errorf("content = %s, want the old file with the edit added", content)
	}
}

func TestR2ExifEditProblems(t *testing.T) {
	repo := &baseURLRepo{pull: true, files: map[string]string{"DSC0001.json": fixedPhoto}}
	c := repo.start(t)
	path := photosDir + "DSC0001.json"
	if _, err := c.RecordR2ExifEdit(t.Context(), baseURLSettings, path, "photos/other.jpg", nil); err == nil ||
		!strings.Contains(err.Error(), "another original") {
		t.Errorf("RecordR2ExifEdit() for another key error = %v", err)
	}
	if key, err := c.R2ExifKey(t.Context(), baseURLSettings, path); err != nil || key != "photos/ab-DSC0001.jpg" {
		t.Errorf("R2ExifKey() = %q, %v", key, err)
	}
}
