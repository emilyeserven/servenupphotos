package bookpdf

import (
	"context"
	"fmt"
	"math"

	"github.com/chromedp/cdproto/emulation"
	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
)

// imageQuality is the WEBP quality a spread's image is saved at: small, with
// the photos still clear enough to judge.
const imageQuality = 80

// Sheet is the size of the pages to make an image of, in CSS pixels as the
// Book tab drew them, and how many pixels the image's longer side has.
type Sheet struct {
	// Width and Height are the pages' size in CSS pixels.
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
	// Longest is how many pixels the image's longer side has; the pages are
	// scaled to it.
	Longest int `json:"longest"`
}

// Valid reports whether the sheet has a size and an image size Chrome can
// draw.
func (s Sheet) Valid() bool {
	return s.Width > 0 && s.Height > 0 && s.Width <= 20000 && s.Height <= 20000 &&
		s.Longest > 0 && s.Longest <= 4000
}

// scale is how many image pixels each CSS pixel of the pages takes, for the image's longer side to be
// Longest pixels.
func (s Sheet) scale() float64 {
	return float64(s.Longest) / math.Max(s.Width, s.Height)
}

// Image draws html, a whole page holding pages of sheet's size at its top
// left, as a WEBP image whose longer side is sheet.Longest pixels. Chrome's
// window is the pages' size, its pixel ratio scaled to the image, so each
// photo loads the resized version that fits the image, never its original
// JPEG. It tells
// report how far it has got, as Make does.
func Image(ctx context.Context, html string, sheet Sheet, report func(Progress)) ([]byte, error) {
	setup := func(cctx context.Context) error {
		_, err := chromedp.Call(cctx, emulation.SetDeviceMetricsOverride, emulation.SetDeviceMetricsOverrideParams{
			Width:             int64(math.Ceil(sheet.Width)),
			Height:            int64(math.Ceil(sheet.Height)),
			DeviceScaleFactor: sheet.scale(),
		})
		return err
	}
	var img []byte
	err := openPages(ctx, html, setup, report, func(cctx context.Context) error {
		report(Progress{Step: StepPrinting, Total: 1})
		quality := int64(imageQuality)
		shot, err := chromedp.Call(cctx, page.CaptureScreenshot, page.CaptureScreenshotParams{
			Format:  page.CaptureScreenshotFormatWebp,
			Quality: &quality,
			Clip:    &page.Viewport{Width: sheet.Width, Height: sheet.Height, Scale: 1},
		})
		if err != nil {
			return fmt.Errorf("drawing the image: %w", err)
		}
		img = shot.Data
		return nil
	})
	return img, err
}
