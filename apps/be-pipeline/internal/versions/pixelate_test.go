package versions

import (
	"bytes"
	"image"
	"image/color"
	"os"
	"testing"
)

// stripes is a w×h picture of one-pixel black and white columns, so any
// pixelation shows as gray.
func stripes(w, h int) *image.NRGBA {
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	for y := range h {
		for x := range w {
			c := color.NRGBA{A: 255}
			if x%2 == 0 {
				c.R, c.G, c.B = 255, 255, 255
			}
			img.SetNRGBA(x, y, c)
		}
	}
	return img
}

func TestPixelateAveragesEachBlock(t *testing.T) {
	img := stripes(40, 20)
	out := Pixelate(img, Faces{{X: 10, Y: 0, Width: 20, Height: 10, Blocks: 2}})

	// Inside the face, every 10×10 block is the stripes' average gray.
	for _, p := range []image.Point{{10, 0}, {19, 9}, {20, 5}, {29, 9}} {
		if got := color.NRGBAModel.Convert(out.At(p.X, p.Y)).(color.NRGBA); got.R != 127 || got.R != got.G {
			t.Errorf("pixel %v = %+v, want gray 127", p, got)
		}
	}
	// Outside it, the stripes are left alone, and so is the photo passed in.
	for _, p := range []image.Point{{8, 0}, {9, 5}, {30, 0}, {12, 15}} {
		if got, want := out.At(p.X, p.Y), img.At(p.X, p.Y); got != want {
			t.Errorf("pixel %v = %v, want %v", p, got, want)
		}
	}
	if img.NRGBAAt(10, 0).R != 255 {
		t.Error("Pixelate changed the photo passed in")
	}
}

func TestPixelateClipsToThePhoto(t *testing.T) {
	out := Pixelate(stripes(20, 20), Faces{{X: 15, Y: 15, Width: 30, Height: 30, Blocks: 3}})
	if out.Bounds() != image.Rect(0, 0, 20, 20) {
		t.Fatalf("bounds = %v", out.Bounds())
	}
	if got := color.NRGBAModel.Convert(out.At(19, 19)).(color.NRGBA); got.R == 0 || got.R == 255 {
		t.Errorf("corner pixel = %+v, want it pixelated", got)
	}
}

func TestPixelateWithoutFacesKeepsThePhoto(t *testing.T) {
	img := stripes(4, 4)
	if out := Pixelate(img, nil); out != image.Image(img) {
		t.Error("want the same photo back")
	}
}

func TestFacesRoundTrip(t *testing.T) {
	fs := Faces{{X: 1, Y: 2, Width: 30, Height: 40, Blocks: 8}, {X: 100, Y: 0, Width: 5, Height: 5, Blocks: 3}}
	got, ok := ParseFaces(fs.String())
	if !ok || got.String() != fs.String() {
		t.Fatalf("ParseFaces(%q) = %v, %v", fs.String(), got, ok)
	}
	if got, ok := ParseFaces(""); !ok || got != nil {
		t.Errorf("ParseFaces(\"\") = %v, %v, want no faces", got, ok)
	}
	for _, bad := range []string{"1,2,3", "1,2,3,4,1", "a,b,c,d,e", "1,2,3,4,8;", "01,2,3,4,8"} {
		if _, ok := ParseFaces(bad); ok {
			t.Errorf("ParseFaces(%q) succeeded", bad)
		}
	}
}

func TestFacesValid(t *testing.T) {
	for _, tc := range []struct {
		face Face
		ok   bool
	}{
		{Face{X: 0, Y: 0, Width: 10, Height: 10, Blocks: 8}, true},
		{Face{X: 0, Y: 0, Width: 0, Height: 10, Blocks: 8}, false},
		{Face{X: -1, Y: 0, Width: 10, Height: 10, Blocks: 8}, false},
		{Face{X: 0, Y: 0, Width: 10, Height: 10, Blocks: 1}, false},
		{Face{X: 0, Y: 0, Width: 10, Height: 10, Blocks: MaxBlocks + 1}, false},
	} {
		if got := (Faces{tc.face}).Valid() == ""; got != tc.ok {
			t.Errorf("Valid(%+v) ok = %v, want %v", tc.face, got, tc.ok)
		}
	}
}

func TestEncodeOnlyRecordsItsFaces(t *testing.T) {
	faces := Faces{{X: 10, Y: 10, Width: 50, Height: 50, Blocks: 4}}
	encoded, err := EncodeOnly(bytes.NewReader(testJPEG(t, 200, 100)), []Version{All[4], Thumbnail}, nil, faces)
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range encoded {
		if e.Faces.String() != faces.String() {
			t.Errorf("%s faces = %v, want %v", e.Name, e.Faces, faces)
		}
	}
}

func TestDetectFacesOnAPlainPhotoFindsNone(t *testing.T) {
	faces, err := DetectFaces(stripes(300, 200))
	if err != nil {
		t.Fatal(err)
	}
	if len(faces) != 0 {
		t.Errorf("found %v on stripes", faces)
	}
}

// testdata/face.jpg is Pigo's own sample photo (github.com/esimov/pigo,
// testdata/sample.jpg, MIT): one person facing the camera.
func TestDetectFacesFindsTheFace(t *testing.T) {
	f, err := os.Open("testdata/face.jpg")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close() //nolint:errcheck // read-only
	img, err := Decode(f)
	if err != nil {
		t.Fatal(err)
	}
	faces, err := DetectFaces(img)
	if err != nil {
		t.Fatal(err)
	}
	if len(faces) != 1 {
		t.Fatalf("found %v, want one face", faces)
	}
	face := faces[0]
	// The face is in the middle of the 320×400 photo.
	if cx, cy := face.X+face.Width/2, face.Y+face.Height/2; cx < 120 || cx > 200 || cy < 150 || cy > 250 {
		t.Errorf("face %+v isn't in the middle", face)
	}
	if face.Blocks != DefaultBlocks {
		t.Errorf("blocks = %d, want %d", face.Blocks, DefaultBlocks)
	}
}
