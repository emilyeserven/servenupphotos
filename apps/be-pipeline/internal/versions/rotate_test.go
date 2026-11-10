package versions

import (
	"image"
	"testing"
)

func TestPixelateTurnedBoxOnlyInsideIt(t *testing.T) {
	// A 40 × 10 box in the middle of a 60 × 60 photo, turned a quarter, stands
	// 10 wide and 40 tall.
	face := Face{X: 10, Y: 25, Width: 40, Height: 10, Blocks: 8, Rotation: 90}
	out := Pixelate(stripes(60, 60), Faces{face})
	if !gray(out, 30, 12) || !gray(out, 30, 47) {
		t.Error("the turned box's top and bottom aren't pixelated")
	}
	if gray(out, 12, 30) || gray(out, 47, 30) {
		t.Error("the box's ends before it was turned are pixelated, want them kept")
	}
}

func TestPixelateTurnedBoxWithWholeBlocksReachesPastIt(t *testing.T) {
	// Turned 45°, the box's corner points at the middle of each side of its bounds.
	inside := Face{X: 20, Y: 20, Width: 20, Height: 20, Blocks: 4, Rotation: 45}
	blocks := inside
	blocks.Edge = EdgeBlocks
	b := inside.bounds()
	if b != image.Rect(15, 15, 45, 45) {
		t.Fatalf("bounds = %v", b)
	}
	// The bounds' top-left corner is outside the turned box, but its block
	// (5 px, from 15, 15) touches the box's edge only with EdgeBlocks.
	if gray(Pixelate(stripes(60, 60), Faces{inside}), 16, 16) {
		t.Error("a pixel outside the turned box is pixelated")
	}
	whole := Pixelate(stripes(60, 60), Faces{blocks})
	if !gray(whole, 30, 16) {
		t.Error("the block at the turned box's top corner isn't pixelated whole")
	}
}

func TestKeptTurnedCircle(t *testing.T) {
	img := stripes(60, 60)
	// A thin oval turned a quarter stands upright: its top is kept, its old
	// ends are pixelated.
	keep := Face{X: 10, Y: 25, Width: 40, Height: 10, Blocks: 8, Shape: ShapeCircle, Keep: true, Rotation: 90}
	out := Pixelate(img, Faces{{X: 0, Y: 0, Width: 60, Height: 60, Blocks: 6}, keep})
	if got, want := out.At(30, 15), img.At(30, 15); got != want {
		t.Errorf("kept pixel = %v, want the photo's %v", got, want)
	}
	if !gray(out, 15, 30) {
		t.Error("the oval's old end is kept, want it pixelated")
	}
}

func TestFacesRoundTripRotation(t *testing.T) {
	fs := Faces{
		{X: 1, Y: 2, Width: 30, Height: 40, Blocks: 8, Rotation: -30},
		{X: 1, Y: 2, Width: 30, Height: 40, Blocks: 8, Edge: EdgeBlocks, Rotation: 15, Keep: true},
		{X: 1, Y: 2, Width: 30, Height: 40, Blocks: 8, Shape: ShapeCircle, Rotation: 180},
	}
	want := "1,2,30,40,8,rot-30;1,2,30,40,8,box-blocks,rot15,keep;1,2,30,40,8,circle,rot180"
	if got := fs.String(); got != want {
		t.Errorf("String = %q, want %q", got, want)
	}
	got, ok := ParseFaces(want)
	if !ok || got[0].Rotation != -30 || got[1].Edge != EdgeBlocks || !got[1].Keep || got[2].Rotation != 180 {
		t.Errorf("ParseFaces = %+v, %v", got, ok)
	}
	for _, bad := range []string{"1,2,30,40,8,rot0", "1,2,30,40,8,rot200", "1,2,30,40,8,rotx", "1,2,30,40,8,rot5,circle"} {
		if _, ok := ParseFaces(bad); ok {
			t.Errorf("ParseFaces(%q) succeeded", bad)
		}
	}
}
