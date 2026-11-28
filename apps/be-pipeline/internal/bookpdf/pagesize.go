package bookpdf

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
)

// mediaBox matches a page's size as Chrome writes it in the PDF, such as
// "/MediaBox [0 0 1921.9199 836.88]".
var mediaBox = regexp.MustCompile(`/MediaBox\s*\[\s*0\s+0\s+[0-9.]+\s+[0-9.]+\s*\]`)

// SetPageSize sets every page of a PDF Chrome made to width by height
// points exactly. Chrome rounds a page's size to its own units, so a page
// asked for at 11.625 in comes out about 0.002 in short, and a printer such
// as Blurb asks for the size to the thousandth. Each size is rewritten in
// place, padded with spaces to the bytes it had so the PDF's table of where
// each part starts still holds; one with too few bytes to fit the new
// numbers is left as Chrome wrote it.
//
// > Frontend analogy: like patching a value in a minified bundle without
// changing its length, so its source map's offsets still line up.
func SetPageSize(pdf []byte, width, height float64) []byte {
	box := fmt.Sprintf("/MediaBox [0 0 %s %s", points(width), points(height))
	return mediaBox.ReplaceAllFunc(pdf, func(old []byte) []byte {
		if len(box)+1 > len(old) {
			return old
		}
		return []byte(box + strings.Repeat(" ", len(old)-len(box)-1) + "]")
	})
}

// points writes n to the thousandth of a point, without trailing zeros.
func points(n float64) string {
	return strconv.FormatFloat(math.Round(n*1000)/1000, 'f', -1, 64)
}
