package colors

import (
	"math"
	"slices"

	"github.com/lucasb-eyer/go-colorful"
)

// Raw is lower-level color data over all sampled pixels, in go-colorful's
// native scales (mostly 0–1; Lab-family a/b and u/v roughly -1–1).
type Raw struct {
	// Spaces has per-channel statistics in each color space go-colorful
	// converts to. Hue channels are left out because hue is circular, so a
	// mean or percentile of it is meaningless; see Histograms.Hue instead.
	Spaces     []Space    `json:"spaces"`
	Histograms Histograms `json:"histograms"`
}

// Space is one color space and statistics for each of its channels.
type Space struct {
	Name     string    `json:"name"`
	Channels []Channel `json:"channels"`
}

// Channel holds statistics for one channel over all sampled pixels.
type Channel struct {
	Name   string  `json:"name"`
	Min    float64 `json:"min"`
	P5     float64 `json:"p5"`
	Median float64 `json:"median"`
	Mean   float64 `json:"mean"`
	P95    float64 `json:"p95"`
	Max    float64 `json:"max"`
	StdDev float64 `json:"stdDev"`
}

// Histograms bins sampled pixels; every share is of all sampled pixels.
type Histograms struct {
	// Hue is HSV hue in 10° bins, counting only pixels that are not neutral.
	Hue []Bin `json:"hue"`
	// Lightness is CIELAB L* (0–100) in 20 bins.
	Lightness []Bin `json:"lightness"`
	// Chroma is CIELAB chroma in 20 bins from 0 to 100; higher values fall in
	// the last bin.
	Chroma []Bin `json:"chroma"`
	// Saturation is HSV saturation (0–1) in 20 bins.
	Saturation []Bin `json:"saturation"`
}

// spaceDef converts a pixel to one color space; channels names its outputs
// and skip marks the hue channel (by index) to leave out, or -1.
type spaceDef struct {
	name     string
	channels [3]string
	skip     int
	convert  func(colorful.Color) (float64, float64, float64)
}

var spaceDefs = []spaceDef{
	{"rgb", [3]string{"r", "g", "b"}, -1, func(c colorful.Color) (float64, float64, float64) { return c.R, c.G, c.B }},
	{"linearRgb", [3]string{"r", "g", "b"}, -1, colorful.Color.LinearRgb},
	{"hsv", [3]string{"h", "s", "v"}, 0, colorful.Color.Hsv},
	{"hsl", [3]string{"h", "s", "l"}, 0, colorful.Color.Hsl},
	{"xyz", [3]string{"x", "y", "z"}, -1, colorful.Color.Xyz},
	{"xyy", [3]string{"x", "y", "Y"}, -1, colorful.Color.Xyy},
	{"lab", [3]string{"l", "a", "b"}, -1, colorful.Color.Lab},
	{"luv", [3]string{"l", "u", "v"}, -1, colorful.Color.Luv},
	{"hcl", [3]string{"h", "c", "l"}, 0, colorful.Color.Hcl},
	{"luvLch", [3]string{"l", "c", "h"}, 2, colorful.Color.LuvLCh},
	{"okLab", [3]string{"l", "a", "b"}, -1, colorful.Color.OkLab},
	{"okLch", [3]string{"l", "c", "h"}, 2, colorful.Color.OkLch},
	{"hsluv", [3]string{"h", "s", "l"}, 0, colorful.Color.HSLuv},
}

const (
	hueBinWidth = 10
	rawBins     = 20
)

func rawStats(pixels []colorful.Color) Raw {
	spaces := make([]Space, len(spaceDefs))
	var values [3][]float64
	for ch := range values {
		values[ch] = make([]float64, len(pixels))
	}
	for i, def := range spaceDefs {
		for p, c := range pixels {
			values[0][p], values[1][p], values[2][p] = def.convert(c)
		}
		spaces[i].Name = def.name
		for ch, name := range def.channels {
			if ch != def.skip {
				spaces[i].Channels = append(spaces[i].Channels, channelStats(name, values[ch]))
			}
		}
	}
	return Raw{Spaces: spaces, Histograms: histograms(pixels)}
}

func channelStats(name string, values []float64) Channel {
	sorted := slices.Clone(values)
	slices.Sort(sorted)

	var sum float64
	for _, v := range sorted {
		sum += v
	}
	mean := sum / float64(len(sorted))
	var sq float64
	for _, v := range sorted {
		sq += (v - mean) * (v - mean)
	}

	return Channel{
		Name:   name,
		Min:    round4(sorted[0]),
		P5:     round4(percentile(sorted, 0.05)),
		Median: round4(percentile(sorted, 0.5)),
		Mean:   round4(mean),
		P95:    round4(percentile(sorted, 0.95)),
		Max:    round4(sorted[len(sorted)-1]),
		StdDev: round4(math.Sqrt(sq / float64(len(sorted)))),
	}
}

// percentile returns the nearest-rank percentile p (0–1) of sorted values.
func percentile(sorted []float64, p float64) float64 {
	return sorted[min(len(sorted)-1, int(p*float64(len(sorted))))]
}

func histograms(pixels []colorful.Color) Histograms {
	hue := make([]int, 360/hueBinWidth)
	lightness := make([]int, rawBins)
	chroma := make([]int, rawBins)
	saturation := make([]int, rawBins)
	for _, c := range pixels {
		lab := toLab(c)
		h, s, _ := c.Hsv()
		if !isNeutral(lab) {
			hue[binOf(h, 360, len(hue))]++
		}
		lightness[binOf(lab.L, 100, rawBins)]++
		chroma[binOf(math.Hypot(lab.A, lab.B), 100, rawBins)]++
		saturation[binOf(s, 1, rawBins)]++
	}

	n := float64(len(pixels))
	h := Histograms{
		Hue:        toBins(hue, 360, n),
		Lightness:  toBins(lightness, 100, n),
		Chroma:     toBins(chroma, 100, n),
		Saturation: toBins(saturation, 1, n),
	}
	for i := range h.Hue {
		h.Hue[i].Hex = colorful.Hsv(h.Hue[i].From+hueBinWidth/2, 1, 1).Hex()
	}
	return h
}

func toBins(counts []int, hi, n float64) []Bin {
	bins := make([]Bin, len(counts))
	for i, count := range counts {
		from, to := binRange(i, hi, len(counts))
		bins[i] = Bin{From: from, To: to, Share: share(count, n)}
	}
	return bins
}

func round4(v float64) float64 {
	return math.Round(v*1e4) / 1e4
}
