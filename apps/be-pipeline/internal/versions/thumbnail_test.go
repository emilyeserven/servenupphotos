package versions

import (
	"bytes"
	"image"
	"image/color"
	"testing"
)

func TestCenterCrop(t *testing.T) {
	for _, tc := range []struct {
		w, h int
		want Crop
	}{
		{3000, 2000, Crop{X: 500, Y: 0, Size: 2000}},
		{1000, 2000, Crop{X: 0, Y: 500, Size: 1000}},
		{800, 800, Crop{X: 0, Y: 0, Size: 800}},
	} {
		if got := CenterCrop(tc.w, tc.h); got != tc.want {
			t.Errorf("CenterCrop(%d, %d) = %+v, want %+v", tc.w, tc.h, got, tc.want)
		}
	}
}

func TestCropFit(t *testing.T) {
	for _, tc := range []struct {
		name string
		crop Crop
		want Crop
	}{
		{"inside", Crop{X: 100, Y: 50, Size: 300}, Crop{X: 100, Y: 50, Size: 300}},
		{"past the right edge", Crop{X: 900, Y: 0, Size: 300}, Crop{X: 700, Y: 0, Size: 300}},
		{"before the top-left corner", Crop{X: -20, Y: -5, Size: 300}, Crop{X: 0, Y: 0, Size: 300}},
		{"bigger than the photo", Crop{X: 50, Y: 50, Size: 5000}, Crop{X: 50, Y: 0, Size: 600}},
		{"no size", Crop{X: 50, Y: 50}, Crop{X: 200, Y: 0, Size: 600}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := tc.crop.Fit(1000, 600); got != tc.want {
				t.Errorf("Fit = %+v, want %+v", got, tc.want)
			}
		})
	}
}

func TestSquareIsAlwaysEdgeSize(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 3000, 2000))
	for _, crop := range []*Crop{nil, {X: 10, Y: 10, Size: 120}, {X: 0, Y: 0, Size: 1800}} {
		if got := Square(img, crop, 500).Bounds().Size(); got != image.Pt(500, 500) {
			t.Errorf("Square(%+v) = %v, want 500×500", crop, got)
		}
	}
}

func TestSquareCutsTheCrop(t *testing.T) {
	// The left half is red and the right half blue, so a crop of the right
	// half is all blue.
	img := image.NewRGBA(image.Rect(0, 0, 400, 200))
	for x := range 400 {
		for y := range 200 {
			c := color.RGBA{255, 0, 0, 255}
			if x >= 200 {
				c = color.RGBA{0, 0, 255, 255}
			}
			img.Set(x, y, c)
		}
	}
	square := Square(img, &Crop{X: 200, Y: 0, Size: 200}, 500)
	for _, p := range []image.Point{{0, 0}, {250, 250}, {499, 499}} {
		if r, _, b, _ := square.At(p.X, p.Y).RGBA(); r > 0x1000 || b < 0xf000 {
			t.Errorf("pixel %v = %v, want blue", p, square.At(p.X, p.Y))
		}
	}
}

func TestEncodeUploadUsesTheCrop(t *testing.T) {
	encoded, err := EncodeUpload(bytes.NewReader(testJPEG(t, 600, 400)), &Crop{X: 20, Y: 30, Size: 100})
	if err != nil {
		t.Fatal(err)
	}
	thumbnail, preview := encoded[len(encoded)-2], encoded[len(encoded)-1]
	if thumbnail.Name != Thumbnail.Name || preview.Name != ThumbnailPreview.Name {
		t.Fatalf("last versions = %s, %s, want %s, %s", thumbnail.Name, preview.Name, Thumbnail.Name, ThumbnailPreview.Name)
	}
	if got := size(t, thumbnail.Data); got != image.Pt(500, 500) {
		t.Errorf("thumbnail = %v, want 500×500", got)
	}
	if got := size(t, preview.Data); got != image.Pt(40, 40) {
		t.Errorf("thumbnail preview = %v, want 40×40", got)
	}
	if thumbnail.Crop == nil || preview.Crop == nil || *thumbnail.Crop != *preview.Crop {
		t.Errorf("crops = %+v, %+v, want the same square", thumbnail.Crop, preview.Crop)
	}
}

func TestThumbnailPreviewCutsTheSameSquare(t *testing.T) {
	// Only the right half is blue, so both squares cut from it are all blue.
	img := image.NewRGBA(image.Rect(0, 0, 400, 200))
	for x := range 400 {
		for y := range 200 {
			c := color.RGBA{255, 0, 0, 255}
			if x >= 200 {
				c = color.RGBA{0, 0, 255, 255}
			}
			img.Set(x, y, c)
		}
	}
	square := Square(img, &Crop{X: 200, Y: 0, Size: 200}, ThumbnailPreview.MaxEdge)
	if got := square.Bounds().Size(); got != image.Pt(40, 40) {
		t.Fatalf("size = %v, want 40×40", got)
	}
	for _, p := range []image.Point{{0, 0}, {20, 20}, {39, 39}} {
		if r, _, b, _ := square.At(p.X, p.Y).RGBA(); r > 0x1000 || b < 0xf000 {
			t.Errorf("pixel %v = %v, want blue", p, square.At(p.X, p.Y))
		}
	}
}

func TestEncodeOnlyThumbnailRecordsItsCrop(t *testing.T) {
	encoded, err := EncodeOnly(bytes.NewReader(testJPEG(t, 600, 400)), []Version{All[3], Thumbnail}, &Crop{X: 550, Y: 20, Size: 100})
	if err != nil {
		t.Fatal(err)
	}
	if encoded[0].Crop != nil {
		t.Errorf("%s crop = %+v, want none", encoded[0].Name, encoded[0].Crop)
	}
	// Fitted inside the 600×400 photo.
	if got, want := encoded[1].Crop, (Crop{X: 500, Y: 20, Size: 100}); got == nil || *got != want {
		t.Errorf("thumbnail crop = %+v, want %+v", got, want)
	}
}

func TestParseCrop(t *testing.T) {
	if c, ok := ParseCrop(Crop{X: 12, Y: 0, Size: 900}.String()); !ok || c != (Crop{X: 12, Y: 0, Size: 900}) {
		t.Errorf("round trip = %+v, %v", c, ok)
	}
	for _, s := range []string{"", "1,2", "1,2,0", "a,b,c", "1,2,3,4", " 1,2,3"} {
		if c, ok := ParseCrop(s); ok {
			t.Errorf("ParseCrop(%q) = %+v, want false", s, c)
		}
	}
}

func TestFindPublished(t *testing.T) {
	if v, ok := FindPublished("thumbnail"); !ok || v != Thumbnail {
		t.Errorf("FindPublished(thumbnail) = %v, %v", v, ok)
	}
	if _, ok := Find("thumbnail"); ok {
		t.Error("Find found the thumbnail, which isn't a resized version")
	}
	if v, ok := FindPublished("thumbnailpreview"); !ok || v != ThumbnailPreview {
		t.Errorf("FindPublished(thumbnailpreview) = %v, %v", v, ok)
	}
}
