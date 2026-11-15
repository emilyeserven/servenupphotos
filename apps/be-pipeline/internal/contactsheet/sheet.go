// Package contactsheet draws contact sheets: many photos as small numbered
// tiles on one JPEG, each labeled with its number and the name a prompt calls
// it by, so an LLM can look at dozens of photos in one image instead of
// opening each one's link.
package contactsheet

import (
	"bytes"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"strconv"
	"sync"

	"github.com/disintegration/imaging"
	"golang.org/x/image/font"
	"golang.org/x/image/font/gofont/gobold"
	"golang.org/x/image/font/gofont/goregular"
	"golang.org/x/image/font/opentype"
	"golang.org/x/image/math/fixed"
)

// The grid of a sheet: PerSheet tiles, Columns across, each photo fit inside
// a square of tileEdge pixels with its label in a strip below it. A full
// sheet is 1496 × 1398 pixels, under the 1568 pixels Claude scales a long
// edge down to, so the labels stay sharp.
const (
	// Columns is how many tiles a row of a sheet has.
	Columns = 6
	// PerSheet is how many tiles one sheet holds at most: 5 rows of 6.
	PerSheet  = 30
	tileEdge  = 240
	labelSize = 30
	gap       = 8
	quality   = 85
)

var (
	background = color.RGBA{R: 0x1c, G: 0x1c, B: 0x1c, A: 0xff}
	missingBox = color.RGBA{R: 0x3a, G: 0x3a, B: 0x3a, A: 0xff}
	numberInk  = color.RGBA{R: 0xff, G: 0xd2, B: 0x4d, A: 0xff}
	labelInk   = color.RGBA{R: 0xf2, G: 0xf2, B: 0xf2, A: 0xff}
	mutedInk   = color.RGBA{R: 0xa0, G: 0xa0, B: 0xa0, A: 0xff}
)

// Tile is one photo on a sheet.
type Tile struct {
	// Number is the photo's number in the prompt, counted from 1, drawn
	// first in its label.
	Number int
	// Label is the name the prompt calls the photo by, such as
	// 20161216_092741, drawn after its number and shortened with "…" when
	// it doesn't fit.
	Label string
	// Image is the photo, any size; nil draws a gray box saying it couldn't
	// be read, so the numbers of the tiles after it still match the prompt.
	Image image.Image
}

// faces are the bold face numbers are drawn in and the regular one labels
// are, parsed once. A face isn't safe to use from two goroutines at once, so
// sheets are drawn one at a time.
var faces = sync.OnceValues(func() (font.Face, font.Face) {
	return mustFace(gobold.TTF, 20), mustFace(goregular.TTF, 16)
})

// mustFace is the font in ttf at size points, at 72 DPI so a point is a
// pixel. The Go fonts are built in, so a failure is a bug.
func mustFace(ttf []byte, size float64) font.Face {
	parsed, err := opentype.Parse(ttf)
	if err != nil {
		panic(err)
	}
	face, err := opentype.NewFace(parsed, &opentype.FaceOptions{Size: size, DPI: 72, Hinting: font.HintingFull})
	if err != nil {
		panic(err)
	}
	return face
}

// Size is the width and height in pixels of a sheet with n tiles: Columns
// wide (or n, when fewer), and as many rows as they fill.
func Size(n int) (width, height int) {
	cols := min(max(n, 1), Columns)
	rows := max((n+Columns-1)/Columns, 1)
	return cols*tileEdge + (cols+1)*gap, rows*(tileEdge+labelSize) + (rows+1)*gap
}

// Split cuts tiles into sheets of PerSheet, in order; the last one may hold
// fewer.
func Split(tiles []Tile) [][]Tile {
	var sheets [][]Tile
	for start := 0; start < len(tiles); start += PerSheet {
		sheets = append(sheets, tiles[start:min(start+PerSheet, len(tiles))])
	}
	return sheets
}

// Draw lays tiles out on one sheet, in order, left to right and top to
// bottom. It draws every tile it's given; callers split photos into sheets
// of PerSheet.
func Draw(tiles []Tile) *image.RGBA {
	width, height := Size(len(tiles))
	sheet := image.NewRGBA(image.Rect(0, 0, width, height))
	draw.Draw(sheet, sheet.Bounds(), image.NewUniform(background), image.Point{}, draw.Src)
	for i, tile := range tiles {
		x := gap + (i%Columns)*(tileEdge+gap)
		y := gap + (i/Columns)*(tileEdge+labelSize+gap)
		drawPhoto(sheet, tile.Image, image.Rect(x, y, x+tileEdge, y+tileEdge))
		drawLabel(sheet, tile, x, y+tileEdge)
	}
	return sheet
}

// drawPhoto fits img inside box, centered, or fills box with gray and says
// the photo couldn't be read when img is nil.
func drawPhoto(sheet *image.RGBA, img image.Image, box image.Rectangle) {
	if img == nil {
		draw.Draw(sheet, box, image.NewUniform(missingBox), image.Point{}, draw.Src)
		_, regular := faces()
		text := "Couldn't read this photo"
		left := box.Min.X + (box.Dx()-font.MeasureString(regular, text).Round())/2
		write(sheet, regular, mutedInk, text, left, box.Min.Y+box.Dy()/2)
		return
	}
	fit := imaging.Fit(img, tileEdge, tileEdge, imaging.Lanczos)
	b := fit.Bounds()
	at := image.Pt(box.Min.X+(box.Dx()-b.Dx())/2, box.Min.Y+(box.Dy()-b.Dy())/2)
	draw.Draw(sheet, image.Rectangle{Min: at, Max: at.Add(b.Size())}, fit, b.Min, draw.Src)
}

// drawLabel writes the tile's number, then its label, in the strip below the
// photo whose left edge is x and bottom is top.
func drawLabel(sheet *image.RGBA, tile Tile, x, top int) {
	bold, regular := faces()
	baseline := top + labelSize - 8
	number := strconv.Itoa(tile.Number)
	write(sheet, bold, numberInk, number, x+2, baseline)
	left := x + 2 + font.MeasureString(bold, number).Round() + 8
	write(sheet, regular, labelInk, Fit(regular, tile.Label, x+tileEdge-left), left, baseline)
}

// Fit is text, shortened with "…" at its end until it's at most width pixels
// wide in face; "" when not even "…" fits.
func Fit(face font.Face, text string, width int) string {
	limit := fixed.I(width)
	if font.MeasureString(face, text) <= limit {
		return text
	}
	runes := []rune(text)
	for n := len(runes) - 1; n >= 0; n-- {
		if short := string(runes[:n]) + "…"; font.MeasureString(face, short) <= limit {
			return short
		}
	}
	return ""
}

// write draws text in face and ink with its baseline starting at x, y.
func write(sheet *image.RGBA, face font.Face, ink color.Color, text string, x, y int) {
	d := font.Drawer{Dst: sheet, Src: image.NewUniform(ink), Face: face, Dot: fixed.P(x, y)}
	d.DrawString(text)
}

// Encode is the sheet as a JPEG.
func Encode(sheet image.Image) ([]byte, error) {
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, sheet, &jpeg.Options{Quality: quality}); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
