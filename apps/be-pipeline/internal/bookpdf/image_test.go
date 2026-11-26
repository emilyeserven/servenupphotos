package bookpdf

import (
	"bytes"
	"context"
	"os"
	"testing"
	"time"

	"github.com/gen2brain/webp"
)

// sampleSpread is two 400 by 250 CSS pixel pages side by side, one dark.
const sampleSpread = `<!doctype html><html><head><style>
body { margin: 0; }
.sheet { display: flex; width: 800px; height: 250px; }
.page { width: 400px; height: 250px; }
</style></head><body><div class="sheet">
<div class="page" style="background: black"></div>
<div class="page" style="background: white"></div>
</div></body></html>`

// webpSize is the width and height of a WEBP image.
func webpSize(t *testing.T, img []byte) (int, int) {
	t.Helper()
	config, err := webp.DecodeConfig(bytes.NewReader(img))
	if err != nil {
		t.Fatalf("got %q, want a WEBP: %v", img[:min(len(img), 16)], err)
	}
	return config.Width, config.Height
}

func TestImageDrawsTheSpreadAtItsLongestSideWhenChromeIsThere(t *testing.T) {
	if os.Getenv("CHROME_PATH") == "" {
		t.Skip("set CHROME_PATH to a Chrome or Chromium to run this test")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	img, err := Image(ctx, sampleSpread, Sheet{Width: 800, Height: 250, Longest: 1600}, func(Progress) {})
	if err != nil {
		t.Fatal(err)
	}
	if w, h := webpSize(t, img); w != 1600 || h != 500 {
		t.Errorf("got %d × %d, want 1600 × 500", w, h)
	}
}

func TestSheetValid(t *testing.T) {
	for _, tc := range []struct {
		sheet Sheet
		want  bool
	}{
		{Sheet{Width: 1536, Height: 960, Longest: 1568}, true},
		{Sheet{Width: 0, Height: 960, Longest: 1568}, false},
		{Sheet{Width: 1536, Height: 960}, false},
		{Sheet{Width: 1536, Height: 960, Longest: 9000}, false},
	} {
		if got := tc.sheet.Valid(); got != tc.want {
			t.Errorf("%+v: got %v, want %v", tc.sheet, got, tc.want)
		}
	}
}
