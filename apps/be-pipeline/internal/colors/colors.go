// Package colors summarises the colors of a photo with go-colorful: its
// average color, the share of the photo in each of a fixed set of color
// buckets, and its mean lightness and chroma.
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
	// count as black, gray or white.
	neutralChroma = 12
	// Lightness bounds for the neutral buckets; very dark pixels are black
	// whatever their chroma.
	blackLightness = 20
	whiteLightness = 85
)

// bucketNames lists the 12 hue buckets every 30° around the HSV color wheel,
// starting at red (centered on 0°), then the neutrals.
var bucketNames = [...]string{
	"red", "orange", "yellow", "chartreuse", "green", "spring green",
	"cyan", "azure", "blue", "violet", "magenta", "rose",
	"black", "gray", "white",
}

const (
	hueBuckets = 12
	black      = hueBuckets
	gray       = hueBuckets + 1
	white      = hueBuckets + 2
)

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

// Bucket is one fixed color category and the share of the photo in it.
type Bucket struct {
	Name string `json:"name"`
	// Hex is the bucket's reference color, for display.
	Hex string `json:"hex"`
	// Share is the fraction (0–1) of sampled pixels in this bucket.
	Share float64 `json:"share"`
}

// Analysis is the color summary of a photo.
type Analysis struct {
	Average Color `json:"average"`
	// Buckets always holds every bucket, in color-wheel order then black,
	// gray and white, so photos can be compared bucket by bucket.
	Buckets   []Bucket `json:"buckets"`
	Lightness float64  `json:"lightness"`
	Chroma    float64  `json:"chroma"`
	Samples   int      `json:"samples"`
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
	var counts [len(bucketNames)]int
	for _, c := range pixels {
		lab := toLab(c)
		sum.L += lab.L
		sum.A += lab.A
		sum.B += lab.B
		chroma += math.Hypot(lab.A, lab.B)
		counts[bucketOf(c, lab)]++
	}
	n := float64(len(pixels))

	buckets := make([]Bucket, len(bucketNames))
	for i, name := range bucketNames {
		buckets[i] = Bucket{
			Name:  name,
			Hex:   bucketHex(i),
			Share: math.Round(float64(counts[i])/n*1e4) / 1e4,
		}
	}

	mean := Lab{sum.L / n, sum.A / n, sum.B / n}
	return Analysis{
		Average:   toColor(mean),
		Buckets:   buckets,
		Lightness: round(mean.L),
		Chroma:    round(chroma / n),
		Samples:   len(pixels),
	}, nil
}

// bucketOf returns the index in bucketNames of the bucket c falls in.
func bucketOf(c colorful.Color, lab Lab) int {
	switch {
	case lab.L < blackLightness:
		return black
	case math.Hypot(lab.A, lab.B) < neutralChroma:
		if lab.L > whiteLightness {
			return white
		}
		return gray
	}
	h, _, _ := c.Hsv()
	return int(math.Mod(h+15, 360)/30) % hueBuckets
}

func bucketHex(i int) string {
	switch i {
	case black:
		return "#000000"
	case gray:
		return "#808080"
	case white:
		return "#ffffff"
	}
	return colorful.Hsv(float64(i*30), 1, 1).Hex()
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
