// Package phash makes a photo's perceptual hash: a 64-bit fingerprint of
// what it looks like, so two photos that look nearly the same, such as two
// frames of a burst or a re-export, can be found by how few bits differ.
//
// > Frontend analogy: like comparing two images by squinting at them. Each
// is shrunk to a 9×8 grey blob, and each bit says whether a pixel is brighter
// than the one to its right, so small edits, crops and re-encoding barely
// change it.
package phash

import (
	"fmt"
	"image"
	"math/bits"
	"strconv"

	"github.com/disintegration/imaging"
)

// Near is the most bits two hashes may differ by for their photos to count
// as near duplicates. Unrelated photos differ by about 32 of the 64.
const Near = 10

// Of is img's difference hash (dHash): img shrunk to 9×8 grey pixels, and
// one bit per pair of side-by-side pixels, set when the left one is brighter.
func Of(img image.Image) uint64 {
	small := imaging.Resize(imaging.Grayscale(img), 9, 8, imaging.Box)
	var hash uint64
	for y := range 8 {
		for x := range 8 {
			hash <<= 1
			if small.Pix[small.PixOffset(x, y)] > small.Pix[small.PixOffset(x+1, y)] {
				hash |= 1
			}
		}
	}
	return hash
}

// Distance is how many bits a and b differ by, from 0 for the same look to
// 64.
func Distance(a, b uint64) int {
	return bits.OnesCount64(a ^ b)
}

// Format is hash as the 16 hex digits a photo file keeps it as.
func Format(hash uint64) string {
	return fmt.Sprintf("%016x", hash)
}

// Parse reads a hash Format wrote. It returns false for anything else.
func Parse(s string) (uint64, bool) {
	if len(s) != 16 {
		return 0, false
	}
	hash, err := strconv.ParseUint(s, 16, 64)
	return hash, err == nil
}
