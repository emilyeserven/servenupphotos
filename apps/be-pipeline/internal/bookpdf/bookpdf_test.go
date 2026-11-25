package bookpdf

import (
	"bytes"
	"context"
	"errors"
	"os"
	"regexp"
	"testing"
	"time"
)

// pageObject finds each page in a PDF.
var pageObject = regexp.MustCompile(`/Type\s*/Page[^s]`)

// samplePages is two pages 5in by 4in, the second with a photo that can't
// load, so waiting for photos ends at once.
const samplePages = `<!doctype html><html><head><style>
@page { size: 5in 4in; margin: 0; }
body { margin: 0; }
.page { width: 5in; height: 4in; break-after: page; background: black; color: white; }
</style></head><body>
<div class="page">Page 1</div>
<div class="page"><img src="data:image/png;base64,broken" alt=""> Page 2</div>
</body></html>`

func TestMakePrintsThePagesWhenChromeIsThere(t *testing.T) {
	if os.Getenv("CHROME_PATH") == "" {
		t.Skip("set CHROME_PATH to a Chrome or Chromium to run this test")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	var steps []string
	pdf, err := Make(ctx, samplePages, 2, func(p Progress) { steps = append(steps, p.Step) })
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.HasPrefix(pdf, []byte("%PDF-")) {
		t.Fatalf("got %q, want a PDF", pdf[:min(len(pdf), 16)])
	}
	if got := len(pageObject.FindAll(pdf, -1)); got != 2 {
		t.Errorf("got %d pages, want 2", got)
	}
	if steps[0] != StepStarting || steps[len(steps)-1] != StepPrinting {
		t.Errorf("steps %v, want starting first and printing last", steps)
	}
}

func TestMakeSaysWhenThereIsNoChrome(t *testing.T) {
	t.Setenv("CHROME_PATH", "/no/such/chrome")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_, err := Make(ctx, samplePages, 2, func(Progress) {})
	if !errors.Is(err, ErrNoChrome) {
		t.Fatalf("got %v, want ErrNoChrome", err)
	}
}
