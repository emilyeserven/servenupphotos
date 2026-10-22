package github

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/exif"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/versions"
)

// oldPhoto is a photo file saved before the title, comment and camera
// settings fields, and before the Square Thumbnail.
const oldPhoto = `{
  "file": "DSC0001.jpg",
  "camera": "X-T5",
  "lens": null,
  "gpsPosition": null,
  "createDate": "2026:05:16 15:24:10",
  "country": null,
  "city": "Tokyo",
  "width": 6240,
  "height": 4160,
  "images": {
    "full": "https://pub-1234.r2.dev/photos/ab-DSC0001.jpg",
    "key": "photos/ab-DSC0001.jpg",
    "medium": "https://pub-1234.r2.dev/photos/ab-DSC0001-medium.webp"
  }
}
`

// fullPhoto is oldPhoto with every field a new photo file has.
func fullPhoto(t *testing.T) string {
	t.Helper()
	raw, err := json.MarshalIndent(newPhotoJSON("DSC0001.jpg", exif.Sanitized{}), "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	return string(raw) + "\n"
}

func TestFindGapsAndFill(t *testing.T) {
	gaps, err := findGaps([]byte(oldPhoto), photoTemplate())
	if err != nil {
		t.Fatalf("findGaps() error = %v", err)
	}
	var fields []string
	for _, g := range gaps {
		fields = append(fields, g.field)
	}
	want := []string{
		"title", "comment", "aperture", "exposure", "iso", "focalLength", "placeName",
		"customCity", "customCountry",
		"images.xlarge", "images.large", "images.small", "images.xsmall",
		"images.preview", "images.thumbnail", "images.thumbnailpreview", "images.thumbnailcrop",
		"isSocialMediaEligible", "websiteSpotlight", "socialMediaPublishDate", "albums", "tags", "places",
	}
	if !reflect.DeepEqual(fields, want) {
		t.Fatalf("fields = %v, want %v", fields, want)
	}

	got := string(fillGaps([]byte(oldPhoto), gaps))
	wantContent := `{
  "title": null,
  "comment": null,
  "file": "DSC0001.jpg",
  "camera": "X-T5",
  "lens": null,
  "aperture": null,
  "exposure": null,
  "iso": null,
  "focalLength": null,
  "gpsPosition": null,
  "createDate": "2026:05:16 15:24:10",
  "placeName": null,
  "customCity": null,
  "customCountry": null,
  "country": null,
  "city": "Tokyo",
  "width": 6240,
  "height": 4160,
  "images": {
    "full": "https://pub-1234.r2.dev/photos/ab-DSC0001.jpg",
    "key": "photos/ab-DSC0001.jpg",
    "xlarge": null,
    "large": null,
    "medium": "https://pub-1234.r2.dev/photos/ab-DSC0001-medium.webp",
    "small": null,
    "xsmall": null,
    "preview": null,
    "thumbnail": null,
    "thumbnailpreview": null,
    "thumbnailcrop": null
  },
  "isSocialMediaEligible": false,
  "websiteSpotlight": null,
  "socialMediaPublishDate": null,
  "albums": [],
  "tags": [],
  "places": []
}
`
	if got != wantContent {
		t.Errorf("fillGaps() =\n%s\nwant\n%s", got, wantContent)
	}
	if again, _ := findGaps([]byte(got), photoTemplate()); len(again) != 0 {
		t.Errorf("filled file still misses %+v", again)
	}
}

func TestFillGapsLayouts(t *testing.T) {
	tests := []struct {
		name, content string
	}{
		{"complete", ""},
		{"no images", `{
  "file": "a.jpg"
}
`},
		{"empty images", `{
  "file": "a.jpg",
  "images": {}
}
`},
		{"empty object", "{}\n"},
		{"one line", `{"file":"a.jpg","images":{"full":null}}`},
		{"tabs and extras", "{\n\t\"note\": \"kept\",\n\t\"file\": \"a.jpg\"\n}\n"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			content := tt.content
			if content == "" {
				content = fullPhoto(t)
			}
			gaps, err := findGaps([]byte(content), photoTemplate())
			if err != nil {
				t.Fatalf("findGaps() error = %v", err)
			}
			got := fillGaps([]byte(content), gaps)
			var fields map[string]any
			if err := json.Unmarshal(got, &fields); err != nil {
				t.Fatalf("filled file isn't valid JSON: %v\n%s", err, got)
			}
			if again, _ := findGaps(got, photoTemplate()); len(again) != 0 {
				t.Errorf("filled file still misses %+v:\n%s", again, got)
			}
			if tt.content == "" && (len(gaps) != 0 || string(got) != content) {
				t.Errorf("complete file changed: %+v", gaps)
			}
			if strings.Contains(content, "\n") && !strings.HasSuffix(string(got), "}\n") {
				t.Errorf("filled file lost its layout:\n%s", got)
			}
		})
	}
	got := string(fillGaps([]byte("{\n  \"file\": \"a.jpg\",\n  \"images\": {}\n}\n"), mustGaps(t, "{\n  \"file\": \"a.jpg\",\n  \"images\": {}\n}\n")))
	if !strings.Contains(got, "  \"images\": {\n    \"full\": null,\n") || !strings.Contains(got, "    \"thumbnailcrop\": null\n  },\n") {
		t.Errorf("empty images filled as\n%s", got)
	}
}

func mustGaps(t *testing.T, content string) []gap {
	t.Helper()
	gaps, err := findGaps([]byte(content), photoTemplate())
	if err != nil {
		t.Fatal(err)
	}
	return gaps
}

func TestPreviewBackfill(t *testing.T) {
	repo := &baseURLRepo{pull: true, files: map[string]string{
		"DSC0001.json": oldPhoto,
		"DSC0002.json": `{"file":"DSC0002.jpg"}`,
		"DSC0003.json": fullPhoto(t),
	}}
	aperture, iso := 5.6, 200
	read := func(_ context.Context, key string) (exif.Sanitized, string) {
		if key != "photos/ab-DSC0001.jpg" {
			t.Errorf("read EXIF of %q", key)
		}
		camera := "Other camera"
		return exif.Sanitized{Aperture: &aperture, ISO: &iso, Camera: &camera}, ""
	}
	got, err := repo.start(t).PreviewBackfill(t.Context(), baseURLSettings, Readers{Exif: read})
	if err != nil {
		t.Fatalf("PreviewBackfill() error = %v", err)
	}
	if got.PhotoFiles != 3 || len(got.Files) != 2 || !got.ReadExif {
		t.Fatalf("preview = %+v, want 2 of 3 files missing fields", got)
	}
	first := got.Files[0]
	if first.Path != "apps/portfolio/src/data/photos/DSC0001.json" || first.ExifError != "" {
		t.Fatalf("first file = %+v", first)
	}
	byField := map[string]AddedField{}
	for _, a := range first.Added {
		byField[a.Field] = a
	}
	if a := byField["aperture"]; string(a.Value) != "5.6" || !a.FromExif {
		t.Errorf("aperture = %+v, want 5.6 from EXIF", a)
	}
	if a := byField["exposure"]; string(a.Value) != "null" || a.FromExif {
		t.Errorf("exposure = %+v, want null by default", a)
	}
	if _, ok := byField["camera"]; ok {
		t.Errorf("camera added, but the file already has it")
	}
	if got.Fields[0] != (MissingField{Field: "title", Files: 2}) {
		t.Errorf("first missing field = %+v, want title in 2 files", got.Fields[0])
	}
}

func TestPreviewBackfillExifFails(t *testing.T) {
	repo := &baseURLRepo{files: map[string]string{"DSC0001.json": oldPhoto}}
	read := func(context.Context, string) (exif.Sanitized, string) {
		return exif.Sanitized{}, "That photo isn't in the bucket anymore."
	}
	got, err := repo.start(t).PreviewBackfill(t.Context(), baseURLSettings, Readers{Exif: read})
	if err != nil {
		t.Fatalf("PreviewBackfill() error = %v", err)
	}
	if len(got.Files) != 1 || got.Files[0].ExifError != "That photo isn't in the bucket anymore." {
		t.Errorf("files = %+v, want the EXIF error", got.Files)
	}
}

func TestBackfill(t *testing.T) {
	repo := &baseURLRepo{pull: true, files: map[string]string{
		"DSC0001.json": oldPhoto,
		"DSC0003.json": fullPhoto(t),
	}}
	got, err := repo.start(t).Backfill(t.Context(), baseURLSettings, Readers{})
	if err != nil {
		t.Fatalf("Backfill() error = %v", err)
	}
	if got.Files != 1 || got.Fields != 23 || got.CommitSHA != "commit2" || got.PullRequestNumber != 7 {
		t.Errorf("Backfill() = %+v", got)
	}
	if len(repo.tree) != 1 || repo.tree[0]["path"] != "apps/portfolio/src/data/photos/DSC0001.json" {
		t.Fatalf("tree = %v, want DSC0001.json only", repo.tree)
	}
	if !strings.HasPrefix(repo.tree[0]["content"], "{\n  \"title\": null,\n  \"comment\": null,\n  \"file\"") {
		t.Errorf("content = %s", repo.tree[0]["content"])
	}
	if repo.commit["message"] != "Add missing fields to 1 photo file" {
		t.Errorf("message = %v", repo.commit["message"])
	}
}

func TestBackfillNothingToAdd(t *testing.T) {
	repo := &baseURLRepo{pull: true, files: map[string]string{"DSC0003.json": fullPhoto(t)}}
	_, err := repo.start(t).Backfill(t.Context(), baseURLSettings, Readers{})
	var perr *PublishError
	if !errors.As(err, &perr) || !strings.Contains(perr.Message, "nothing to add") {
		t.Errorf("Backfill() error = %v, want nothing to add", err)
	}
}

// croppedPhoto has a Square Thumbnail but no thumbnail crop, and is missing
// nothing else.
func croppedPhoto(t *testing.T, thumbnail string) string {
	t.Helper()
	s := exif.Sanitized{}
	key := "photos/ab-DSC0004.jpg"
	s.Images.Key, s.Images.Thumbnail = &key, &thumbnail
	raw, err := json.MarshalIndent(newPhotoJSON("DSC0004.jpg", s), "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	return strings.Replace(string(raw), ",\n    \"thumbnailcrop\": null", "", 1) + "\n"
}

func TestPreviewBackfillThumbnailCrop(t *testing.T) {
	marked := "https://pub-1234.r2.dev/photos/ab-DSC0004-thumbnail.webp?crop=1710,0,4220"
	plain := "https://pub-1234.r2.dev/photos/ab-DSC0004-thumbnail.webp"
	tests := []struct {
		name, thumbnail string
		read            CropReader
		want, cropError string
	}{
		{"from the URL", marked, nil, `{"x":1710,"y":0,"size":4220,"outputSize":500}`, ""},
		{"not marked, not read", plain, nil, "null", ""},
		{"from R2", plain, func(_ context.Context, key string) (*versions.Crop, string) {
			if key != "photos/ab-DSC0004.jpg" {
				t.Errorf("read crop of %q", key)
			}
			return &versions.Crop{X: 0, Y: 12, Size: 300}, ""
		}, `{"x":0,"y":12,"size":300,"outputSize":500}`, ""},
		{"none in R2", plain, func(context.Context, string) (*versions.Crop, string) { return nil, "" }, "null", ""},
		{"R2 fails", plain, func(context.Context, string) (*versions.Crop, string) {
			return nil, "That photo isn't in the bucket anymore."
		}, "null", "That photo isn't in the bucket anymore."},
		{"URL before R2", marked, func(context.Context, string) (*versions.Crop, string) {
			t.Error("read the crop from R2, but the URL has it")
			return nil, ""
		}, `{"x":1710,"y":0,"size":4220,"outputSize":500}`, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &baseURLRepo{files: map[string]string{"DSC0004.json": croppedPhoto(t, tt.thumbnail)}}
			got, err := repo.start(t).PreviewBackfill(t.Context(), baseURLSettings, Readers{Crop: tt.read})
			if err != nil {
				t.Fatalf("PreviewBackfill() error = %v", err)
			}
			if len(got.Files) != 1 || len(got.Files[0].Added) != 1 {
				t.Fatalf("files = %+v, want one missing the crop", got.Files)
			}
			added := got.Files[0].Added[0]
			if added.Field != "images.thumbnailcrop" || string(added.Value) != tt.want || added.FromThumbnail != (tt.want != "null") {
				t.Errorf("added = %+v %s, want %s", added, added.Value, tt.want)
			}
			if got.Files[0].CropError != tt.cropError {
				t.Errorf("CropError = %q, want %q", got.Files[0].CropError, tt.cropError)
			}
		})
	}
}

func TestBackfillThumbnailCropFromURL(t *testing.T) {
	marked := "https://pub-1234.r2.dev/photos/ab-DSC0004-thumbnail.webp?crop=1710,0,4220"
	repo := &baseURLRepo{pull: true, files: map[string]string{"DSC0004.json": croppedPhoto(t, marked)}}
	if _, err := repo.start(t).Backfill(t.Context(), baseURLSettings, Readers{}); err != nil {
		t.Fatalf("Backfill() error = %v", err)
	}
	want := `    "thumbnailpreview": null,
    "thumbnailcrop": {
      "x": 1710,
      "y": 0,
      "size": 4220,
      "outputSize": 500
    }
  },`
	if !strings.Contains(repo.tree[0]["content"], want) {
		t.Errorf("content = %s", repo.tree[0]["content"])
	}
}
