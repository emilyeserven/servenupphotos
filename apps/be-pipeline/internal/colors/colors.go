// Package colors summarises the colors of a photo with go-colorful: its
// average color, a dominant palette, and its mean lightness and chroma.
//
// Values use the conventional CIELAB scales (L, a, b and chroma roughly 0–100,
// hue in degrees) rather than go-colorful's 0–1 scale.
package colors

import (
	"cmp"
	"fmt"
	"image"
	_ "image/jpeg" // register the JPEG decoder
	"io"
	"math"
	"math/rand/v2"
	"slices"

	"github.com/lucasb-eyer/go-colorful"
)

const (
	// PaletteSize is the most colors the palette holds.
	PaletteSize = 12
	// maxSamples caps how many pixels are read, so large photos stay fast.
	maxSamples = 10_000
	// mergeDistance is the CIE76 ΔE below which two palette colors read as one.
	mergeDistance = 5
	maxIterations = 30
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

// Swatch is a palette color and the share of the photo it covers.
type Swatch struct {
	Color
	// Share is the fraction (0–1) of sampled pixels closest to this color.
	Share float64 `json:"share"`
}

// Analysis is the color summary of a photo.
type Analysis struct {
	Average Color `json:"average"`
	// Palette holds up to PaletteSize colors, largest share first.
	Palette   []Swatch `json:"palette"`
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
	for _, p := range pixels {
		sum.L += p.L
		sum.A += p.A
		sum.B += p.B
		chroma += math.Hypot(p.A, p.B)
	}
	n := float64(len(pixels))
	mean := Lab{sum.L / n, sum.A / n, sum.B / n}

	return Analysis{
		Average:   toColor(mean),
		Palette:   palette(pixels),
		Lightness: round(mean.L),
		Chroma:    round(chroma / n),
		Samples:   len(pixels),
	}, nil
}

// sample reads an evenly spaced grid of at most about maxSamples pixels.
func sample(img image.Image) []Lab {
	b := img.Bounds()
	step := max(1, int(math.Ceil(math.Sqrt(float64(b.Dx()*b.Dy())/maxSamples))))

	pixels := make([]Lab, 0, min(b.Dx()*b.Dy(), maxSamples*2))
	for y := b.Min.Y; y < b.Max.Y; y += step {
		for x := b.Min.X; x < b.Max.X; x += step {
			c, ok := colorful.MakeColor(img.At(x, y))
			if !ok {
				continue // fully transparent
			}
			l, a, bb := c.Lab()
			pixels = append(pixels, Lab{l * 100, a * 100, bb * 100})
		}
	}
	return pixels
}

type cluster struct {
	center Lab
	count  int
}

// palette groups pixels with k-means in CIELAB, merges near-identical colors
// and drops empty clusters, so it can return fewer than PaletteSize swatches.
func palette(pixels []Lab) []Swatch {
	clusters := kmeans(pixels, min(PaletteSize, len(pixels)))
	clusters = slices.DeleteFunc(clusters, func(c cluster) bool { return c.count == 0 })
	clusters = mergeClose(clusters)
	slices.SortFunc(clusters, func(a, b cluster) int { return cmp.Compare(b.count, a.count) })

	swatches := make([]Swatch, len(clusters))
	for i, c := range clusters {
		swatches[i] = Swatch{Color: toColor(c.center), Share: math.Round(float64(c.count)/float64(len(pixels))*1e4) / 1e4}
	}
	return swatches
}

func kmeans(pixels []Lab, k int) []cluster {
	centers := seed(pixels, k)
	k = len(centers) // seed stops early when there are fewer distinct colors
	assign := make([]int, len(pixels))
	for i := range assign {
		assign[i] = -1
	}

	clusters := make([]cluster, k)
	for range maxIterations {
		changed := false
		for i, p := range pixels {
			if c := nearest(p, centers); c != assign[i] {
				assign[i] = c
				changed = true
			}
		}

		sums := make([]Lab, k)
		clear(clusters)
		for i, p := range pixels {
			c := assign[i]
			sums[c].L += p.L
			sums[c].A += p.A
			sums[c].B += p.B
			clusters[c].count++
		}
		for c := range clusters {
			if n := float64(clusters[c].count); n > 0 {
				centers[c] = Lab{sums[c].L / n, sums[c].A / n, sums[c].B / n}
			}
			clusters[c].center = centers[c]
		}
		if !changed {
			break
		}
	}
	return clusters
}

// seed picks k starting centers with k-means++. The generator is seeded with
// a constant so the same photo always yields the same palette.
func seed(pixels []Lab, k int) []Lab {
	rng := rand.New(rand.NewPCG(1, 2)) //nolint:gosec // deterministic, not security sensitive
	centers := []Lab{pixels[rng.IntN(len(pixels))]}
	dist := make([]float64, len(pixels))
	for len(centers) < k {
		var total float64
		for i, p := range pixels {
			d := distance(p, centers[nearest(p, centers)])
			dist[i] = d * d
			total += dist[i]
		}
		if total == 0 {
			break // fewer distinct colors than k
		}
		target := rng.Float64() * total
		i := 0
		for ; i < len(dist)-1 && target >= dist[i]; i++ {
			target -= dist[i]
		}
		centers = append(centers, pixels[i])
	}
	return centers
}

// mergeClose repeatedly merges the closest pair of clusters while they are
// within mergeDistance, weighting the merged center by pixel count.
func mergeClose(clusters []cluster) []cluster {
	for {
		bi, bj, best := -1, -1, math.Inf(1)
		for i := range clusters {
			for j := i + 1; j < len(clusters); j++ {
				if d := distance(clusters[i].center, clusters[j].center); d < best {
					bi, bj, best = i, j, d
				}
			}
		}
		if best >= mergeDistance {
			return clusters
		}
		a, b := clusters[bi], clusters[bj]
		n := float64(a.count + b.count)
		wa, wb := float64(a.count)/n, float64(b.count)/n
		clusters[bi] = cluster{
			center: Lab{a.center.L*wa + b.center.L*wb, a.center.A*wa + b.center.A*wb, a.center.B*wa + b.center.B*wb},
			count:  a.count + b.count,
		}
		clusters = slices.Delete(clusters, bj, bj+1)
	}
}

func nearest(p Lab, centers []Lab) int {
	best, bestDist := 0, math.Inf(1)
	for i, c := range centers {
		if d := distance(p, c); d < bestDist {
			best, bestDist = i, d
		}
	}
	return best
}

// distance is the CIE76 color difference (ΔE*ab).
func distance(p, q Lab) float64 {
	return math.Sqrt((p.L-q.L)*(p.L-q.L) + (p.A-q.A)*(p.A-q.A) + (p.B-q.B)*(p.B-q.B))
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
