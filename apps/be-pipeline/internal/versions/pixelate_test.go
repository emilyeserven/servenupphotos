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

// gray reports whether the pixel at x, y of img is pixelated stripes: neither
// black nor white.
func gray(img image.Image, x, y int) bool {
	r := color.NRGBAModel.Convert(img.At(x, y)).(color.NRGBA).R
	return r != 0 && r != 255
}

func TestPixelateCircleKeepsTheCorners(t *testing.T) {
	out := Pixelate(stripes(40, 40), Faces{{X: 0, Y: 0, Width: 40, Height: 40, Blocks: 4, Shape: ShapeCircle}})
	if !gray(out, 20, 20) || !gray(out, 20, 2) {
		t.Error("the middle and top of the circle aren't pixelated")
	}
	for _, p := range []image.Point{{0, 0}, {39, 0}, {0, 39}, {39, 39}, {3, 3}} {
		if gray(out, p.X, p.Y) {
			t.Errorf("corner pixel %v is pixelated, want it kept", p)
		}
	}
}

func TestPixelateCircleWithWholeBlocksReachesPastIt(t *testing.T) {
	circle := Face{X: 0, Y: 0, Width: 40, Height: 40, Blocks: 8, Shape: ShapeCircle}
	blocks := circle
	blocks.Edge = EdgeBlocks
	// With 5 px blocks, the top-left block doesn't touch the circle and stays.
	// The one next to it does, so EdgeBlocks pixelates it whole, its pixel at
	// 5, 0 past the circle included; EdgeInside leaves that pixel alone.
	whole := Pixelate(stripes(40, 40), Faces{blocks})
	if gray(whole, 0, 0) {
		t.Error("the corner block is pixelated, want it kept")
	}
	if !gray(whole, 5, 0) {
		t.Error("the block touching the circle isn't pixelated whole")
	}
	if gray(Pixelate(stripes(40, 40), Faces{circle}), 5, 0) {
		t.Error("EdgeInside pixelated a pixel outside the circle")
	}
}

func TestFacesRoundTripCircles(t *testing.T) {
	fs := Faces{
		{X: 1, Y: 2, Width: 30, Height: 40, Blocks: 8, Shape: ShapeCircle},
		{X: 1, Y: 2, Width: 30, Height: 40, Blocks: 8, Shape: ShapeCircle, Edge: EdgeBlocks},
		{X: 1, Y: 2, Width: 30, Height: 40, Blocks: 8},
	}
	if got := fs.String(); got != "1,2,30,40,8,circle;1,2,30,40,8,circle-blocks;1,2,30,40,8" {
		t.Errorf("String = %q", got)
	}
	got, ok := ParseFaces(fs.String())
	if !ok || got[0].Shape != ShapeCircle || got[1].Edge != EdgeBlocks || got[2].Shape != "" {
		t.Errorf("ParseFaces = %+v, %v", got, ok)
	}
	for _, bad := range []string{"1,2,30,40,8,oval", "1,2,30,40,8,circle,x"} {
		if _, ok := ParseFaces(bad); ok {
			t.Errorf("ParseFaces(%q) succeeded", bad)
		}
	}
	if (Faces{{X: 0, Y: 0, Width: 9, Height: 9, Blocks: 8, Shape: "star"}}).Valid() == "" {
		t.Error("a star shape is valid")
	}
}

func TestKeptAreaUndoesPixelation(t *testing.T) {
	img := stripes(40, 40)
	for _, keep := range []Face{
		{X: 10, Y: 0, Width: 10, Height: 10, Blocks: 8, Keep: true},
		{X: 10, Y: 0, Width: 10, Height: 10, Blocks: 8, Keep: true, Shape: ShapeCircle},
	} {
		// The kept area comes first, but is still applied after every face.
		out := Pixelate(img, Faces{keep, {X: 0, Y: 0, Width: 40, Height: 40, Blocks: 4}})
		if got, want := out.At(15, 5), img.At(15, 5); got != want {
			t.Errorf("kept %s pixel = %v, want the photo's %v", Faces{keep}, got, want)
		}
		if !gray(out, 30, 30) {
			t.Errorf("with %s kept, the rest of the face isn't pixelated", Faces{keep})
		}
	}
	// A kept circle leaves its box's corners pixelated.
	out := Pixelate(img, Faces{{X: 0, Y: 0, Width: 40, Height: 40, Blocks: 4}, {X: 0, Y: 0, Width: 20, Height: 20, Blocks: 8, Keep: true, Shape: ShapeCircle}})
	if !gray(out, 0, 0) {
		t.Error("the kept circle's corner isn't pixelated")
	}
}

func TestFacesRoundTripKeep(t *testing.T) {
	fs := Faces{
		{X: 1, Y: 2, Width: 30, Height: 40, Blocks: 8, Keep: true},
		{X: 1, Y: 2, Width: 30, Height: 40, Blocks: 8, Shape: ShapeCircle, Edge: EdgeBlocks, Keep: true},
	}
	if got := fs.String(); got != "1,2,30,40,8,keep;1,2,30,40,8,circle-blocks,keep" {
		t.Errorf("String = %q", got)
	}
	if got, ok := ParseFaces(fs.String()); !ok || !got[0].Keep || !got[1].Keep || got[1].Edge != EdgeBlocks {
		t.Errorf("ParseFaces = %+v, %v", got, ok)
	}
	if _, ok := ParseFaces("1,2,30,40,8,keep,circle"); ok {
		t.Error("ParseFaces read keep before the shape")
	}
}
