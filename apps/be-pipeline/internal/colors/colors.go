// Package colors summarises the colors of a photo with go-colorful: its
// average color, the share of the photo in each of 12 fixed hue buckets, a
// lightness histogram of its neutral (black, gray and white) pixels, its mean
// lightness and chroma, and raw per-color-space statistics.
//
// Values use the conventional CIELAB scales (L, a, b and chroma roughly 0–100,
// hue in degrees) rather than go-colorful's 0–1 scale.
package colors

import (
	"fmt"
	"image"
	_ "image/jpeg" // register the JPEG decoder
	"io"
	"math"

	"github.com/lucasb-eyer/go-colorful"
)

const (
	// maxSamples caps how many pixels are read, so large photos stay fast.
	maxSamples = 10_000
	// Pixels below this CIELAB chroma are too unsaturated to have a hue and
	// count as neutral (black, gray or white).
	neutralChroma = 12
	// Pixels darker than this CIELAB lightness are neutral whatever their
	// chroma, since their hue is not visible.
	darkLightness = 20
	// neutralBins is how many lightness bins the neutral histogram has.
	neutralBins = 20
)

// bucketNames lists the 12 hue buckets every 30° around the HSV color wheel,
// starting at red (centered on 0°).
var bucketNames = [...]string{
	"red", "orange", "yellow", "chartreuse", "green", "spring green",
	"cyan", "azure", "blue", "violet", "magenta", "rose",
}

// Color is one color in hex, CIELAB and CIE LCh(ab) (HCL) form.
type Color struct {
	Hex string `json:"hex"`
	Lab Lab    `json:"lab"`
	HCL HCL    `json:"hcl"`
}

// Lab is a CIELAB color.
type Lab struct {
	L float64 `json:"l"`
	A float64 `json:"a"`
	B float64 `json:"b"`
}

// HCL is a CIE LCh(ab) color: hue in degrees, chroma, lightness.
type HCL struct {
	H float64 `json:"h"`
	C float64 `json:"c"`
	L float64 `json:"l"`
}

// Bucket is one fixed hue category and the share of the photo in it.
type Bucket struct {
	Name string `json:"name"`
	// Hex is the bucket's reference color, for display.
	Hex string `json:"hex"`
	// Share is the fraction (0–1) of all sampled pixels in this bucket.
	Share float64 `json:"share"`
}

// Neutrals describes the pixels too dark or unsaturated to have a hue.
type Neutrals struct {
	// Share is the fraction (0–1) of all sampled pixels that are neutral.
	Share float64 `json:"share"`
	// Histogram splits the neutral pixels into equal CIELAB lightness bins
	// from black (0) to white (100); each share is of all sampled pixels.
	Histogram []Bin `json:"histogram"`
}

// Bin is one histogram bin covering [From, To).
type Bin struct {
	From float64 `json:"from"`
	To   float64 `json:"to"`
	// Hex is a representative color for the bin, for display.
	Hex   string  `json:"hex,omitempty"`
	Share float64 `json:"share"`
}

// Analysis is the color summary of a photo.
type Analysis struct {
	Average Color `json:"average"`
	// Buckets always holds all 12 hue buckets in color-wheel order, so photos
	// can be compared bucket by bucket. Their shares and Neutrals.Share sum to 1.
	Buckets   []Bucket `json:"buckets"`
	Neutrals  Neutrals `json:"neutrals"`
	Lightness float64  `json:"lightness"`
	Chroma    float64  `json:"chroma"`
	Samples   int      `json:"samples"`
	Raw       Raw      `json:"raw"`
}

// Analyze decodes the image in r and summarises its colors.
func Analyze(r io.Reader) (Analysis, error) {
	img, _, err := image.Decode(r)
	if err != nil {
		return Analysis{}, fmt.Errorf("decode image: %w", err)
	}
	return analyzeImage(img)
}

func analyzeImage(img image.Image) (Analysis, error) {
	pixels := sample(img)
	if len(pixels) == 0 {
		return Analysis{}, fmt.Errorf("image has no opaque pixels")
	}

	var sum Lab
	var chroma float64
	var hues [len(bucketNames)]int
	var neutral [neutralBins]int
	for _, c := range pixels {
		lab := toLab(c)
		sum.L += lab.L
		sum.A += lab.A
		sum.B += lab.B
		chroma += math.Hypot(lab.A, lab.B)
		if isNeutral(lab) {
			neutral[binOf(lab.L, 100, neutralBins)]++
			continue
		}
		hues[hueBucketOf(c)]++
	}
	n := float64(len(pixels))

	buckets := make([]Bucket, len(bucketNames))
	for i, name := range bucketNames {
		buckets[i] = Bucket{
			Name:  name,
			Hex:   colorful.Hsv(float64(i*30), 1, 1).Hex(),
			Share: share(hues[i], n),
		}
	}

	neutrals := Neutrals{Histogram: make([]Bin, neutralBins)}
	for i, count := range neutral {
		from, to := binRange(i, 100, neutralBins)
		neutrals.Histogram[i] = Bin{
			From:  from,
			To:    to,
			Hex:   colorful.Lab((from+to)/200, 0, 0).Clamped().Hex(),
			Share: share(count, n),
		}
		neutrals.Share += float64(count)
	}
	neutrals.Share = share(int(neutrals.Share), n)

	mean := Lab{sum.L / n, sum.A / n, sum.B / n}
	return Analysis{
		Average:   toColor(mean),
		Buckets:   buckets,
		Neutrals:  neutrals,
		Lightness: round(mean.L),
		Chroma:    round(chroma / n),
		Samples:   len(pixels),
		Raw:       rawStats(pixels),
	}, nil
}

// isNeutral reports whether a pixel is too dark or unsaturated to have a hue.
func isNeutral(lab Lab) bool {
	return lab.L < darkLightness || math.Hypot(lab.A, lab.B) < neutralChroma
}

// hueBucketOf returns the index in bucketNames of c's HSV hue.
func hueBucketOf(c colorful.Color) int {
	h, _, _ := c.Hsv()
	return int(math.Mod(h+15, 360)/30) % len(bucketNames)
}

// binOf returns which of bins equal bins over [0, hi] v falls in, clamping
// values outside the range into the first or last bin.
func binOf(v, hi float64, bins int) int {
	return min(bins-1, max(0, int(v/hi*float64(bins))))
}

func binRange(i int, hi float64, bins int) (from, to float64) {
	width := hi / float64(bins)
	return round(float64(i) * width), round(float64(i+1) * width)
}

func share(count int, n float64) float64 {
	return math.Round(float64(count)/n*1e4) / 1e4
}

// sample reads an evenly spaced grid of at most about maxSamples pixels.
func sample(img image.Image) []colorful.Color {
	b := img.Bounds()
	step := max(1, int(math.Ceil(math.Sqrt(float64(b.Dx()*b.Dy())/maxSamples))))

	pixels := make([]colorful.Color, 0, min(b.Dx()*b.Dy(), maxSamples*2))
	for y := b.Min.Y; y < b.Max.Y; y += step {
		for x := b.Min.X; x < b.Max.X; x += step {
			if c, ok := colorful.MakeColor(img.At(x, y)); ok { // !ok: fully transparent
				pixels = append(pixels, c)
			}
		}
	}
	return pixels
}

func toLab(c colorful.Color) Lab {
	l, a, b := c.Lab()
	return Lab{l * 100, a * 100, b * 100}
}

func toColor(lab Lab) Color {
	hue := math.Atan2(lab.B, lab.A) * 180 / math.Pi
	if hue < 0 {
		hue += 360
	}
	return Color{
		Hex: colorful.Lab(lab.L/100, lab.A/100, lab.B/100).Clamped().Hex(),
		Lab: Lab{round(lab.L), round(lab.A), round(lab.B)},
		HCL: HCL{round(hue), round(math.Hypot(lab.A, lab.B)), round(lab.L)},
	}
}

func round(v float64) float64 {
	return math.Round(v*100) / 100
}
