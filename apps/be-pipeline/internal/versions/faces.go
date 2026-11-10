package versions

import (
	_ "embed"
	"image"
	"math"
	"sort"
	"sync"

	"github.com/disintegration/imaging"
	pigo "github.com/esimov/pigo/core"
)

// facefinder is Pigo's trained face cascade, copied from
// github.com/esimov/pigo/cascade (MIT, see cascade/LICENSE): a list of small
// decision trees that each look at a few pixel pairs of a square and vote on
// whether it's a face.
//
//go:embed cascade/facefinder
var facefinder []byte

var (
	finderOnce sync.Once
	finder     *pigo.Pigo
	finderErr  error
)

// faceFinder unpacks the cascade the first time it's needed.
func faceFinder() (*pigo.Pigo, error) {
	finderOnce.Do(func() {
		finder, finderErr = pigo.NewPigo().Unpack(facefinder)
	})
	return finder, finderErr
}

// detectEdge is the longest edge photos are shrunk to before looking for
// faces: plenty to find a face, and much faster than the full photo.
const detectEdge = 1200

// minFaceQuality is the lowest score a found face may have, to leave out
// patches that only look a little like a face.
const minFaceQuality = 5

// facePadding grows each found face by this share of its size on every
// side, since Pigo's square stops at the eyebrows and chin.
const facePadding = 0.15

// DetectFaces finds the faces looking at the camera in img, with Pigo's
// pixel-comparison cascade (github.com/esimov/pigo), largest first, each
// with DefaultBlocks. Faces turned to the side, small or partly hidden ones
// may be missed, so the boxes are a starting point to check by eye.
func DetectFaces(img image.Image) (Faces, error) {
	pg, err := faceFinder()
	if err != nil {
		return nil, err
	}
	b := img.Bounds()
	small := imaging.Fit(img, detectEdge, detectEdge, imaging.Box)
	sb := small.Bounds()
	scale := float64(b.Dx()) / float64(sb.Dx())
	params := pigo.CascadeParams{
		MinSize:     max(20, min(sb.Dx(), sb.Dy())/40),
		MaxSize:     min(sb.Dx(), sb.Dy()),
		ShiftFactor: 0.1,
		ScaleFactor: 1.1,
		ImageParams: pigo.ImageParams{
			Pixels: pigo.RgbToGrayscale(small),
			Rows:   sb.Dy(),
			Cols:   sb.Dx(),
			Dim:    sb.Dx(),
		},
	}
	found := pg.ClusterDetections(pg.RunCascade(params, 0), 0.2)
	faces := make(Faces, 0, len(found))
	for _, d := range found {
		if d.Q < minFaceQuality {
			continue
		}
		faces = append(faces, faceBox(d, scale, b.Dx(), b.Dy()))
	}
	sort.SliceStable(faces, func(i, j int) bool { return faces[i].Width > faces[j].Width })
	if len(faces) > MaxFaces {
		faces = faces[:MaxFaces]
	}
	return faces, nil
}

// faceBox is detection d, found on a photo shrunk by scale, as a padded Face
// on the w×h photo.
func faceBox(d pigo.Detection, scale float64, w, h int) Face {
	side := float64(d.Scale) * scale * (1 + 2*facePadding)
	x := float64(d.Col)*scale - side/2
	y := float64(d.Row)*scale - side/2
	x0, y0 := max(0, int(math.Round(x))), max(0, int(math.Round(y)))
	x1, y1 := min(w, int(math.Round(x+side))), min(h, int(math.Round(y+side)))
	return Face{X: x0, Y: y0, Width: max(1, x1-x0), Height: max(1, y1-y0), Blocks: DefaultBlocks}
}
