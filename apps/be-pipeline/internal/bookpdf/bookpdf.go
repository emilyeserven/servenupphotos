// Package bookpdf makes a photo book's PDF with a headless Chrome: it opens
// the book's pages, as the Book tab drew them, waits for their photos and
// prints them, one sheet of paper the book's page size each. It also draws
// one spread as a small WEBP image (Image), with each photo's resized
// version.
//
// Frontend analogy: it's Playwright's page.goto and page.pdf, run by the
// backend instead of a test.
package bookpdf

import (
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"time"

	cdpio "github.com/chromedp/cdproto/io"
	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
)

// The steps a PDF goes through, as Progress.Step names them.
const (
	// StepStarting is Chrome starting and opening the pages.
	StepStarting = "starting"
	// StepPhotos is waiting for the pages' photos to load, Done of Total.
	StepPhotos = "photos"
	// StepPrinting is Chrome printing the pages, Total of them, to the PDF.
	StepPrinting = "printing"
	// StepDrawing is Chrome drawing the spreads' images, Done of Total.
	StepDrawing = "drawing"
)

// Progress is how far making a PDF has got: Done of Total in Step.
type Progress struct {
	// Step is StepStarting, StepPhotos, StepPrinting or StepDrawing.
	Step string `json:"step"`
	// Done is how many photos have loaded, in StepPhotos, and how many
	// images are drawn, in StepDrawing.
	Done int `json:"done"`
	// Total is how many photos the pages have in StepPhotos, and how many
	// pages are printed in StepPrinting, and how many images are drawn in
	// StepDrawing.
	Total int `json:"total"`
}

// photoCheckEvery is how often the photos' loading is checked.
const photoCheckEvery = 500 * time.Millisecond

// photosCountJS counts the page's photos that have loaded or failed, and all
// of them, once the pages at %q have been read; -1 of them before.
const photosCountJS = `location.href !== %q || document.readyState === "loading"
	? [0, -1]
	: [...document.images].reduce((n, img) => [n[0] + (img.complete ? 1 : 0), n[1] + 1], [0, 0])`

// fontsReadyJS waits for the page's fonts to load.
const fontsReadyJS = `document.fonts.ready.then(() => true)`

// readChunk is how much of the printed PDF is read from Chrome at a time.
const readChunk = 1 << 20

// ErrNoChrome is returned when no Chrome or Chromium could be started.
var ErrNoChrome = errors.New("couldn't start Chrome")

// Make prints html, a whole page whose @page rule sets the paper size, to a
// PDF of pages pages, telling report how far it has got. Chrome is found
// where it's usually installed, or at CHROME_PATH; CHROME_NO_SANDBOX turns
// off Chrome's sandbox, which a container running it as an unprivileged user
// needs.
func Make(ctx context.Context, html string, pages int, report func(Progress)) ([]byte, error) {
	var pdf []byte
	err := openPages(ctx, html, nil, report, func(cctx context.Context) error {
		report(Progress{Step: StepPrinting, Total: pages})
		var err error
		pdf, err = chromedp.Run(cctx, printPDF)
		return err
	})
	return pdf, err
}

// openPages starts Chrome, runs setup on its tab when there is one, such as
// sizing its window, opens html there, waits for its photos and fonts, then
// runs use on the tab while the pages are still open.
func openPages(ctx context.Context, html string, setup func(context.Context) error, report func(Progress), use func(context.Context) error) error {
	report(Progress{Step: StepStarting})
	actx, cancelAlloc := chromedp.NewExecAllocator(ctx, allocatorOptions()...)
	defer cancelAlloc()
	cctx, cancel := chromedp.NewContext(actx)
	defer cancel()

	site, err := servePages(ctx, html)
	if err != nil {
		return err
	}
	defer func() { _ = site.Close() }()
	if setup != nil {
		if err := setup(cctx); err != nil {
			return chromeError(err, "setting up the tab")
		}
	}
	// Opened without waiting for the page to load, which waits for every
	// photo, so waitForPhotos can say how many have.
	if _, err := chromedp.Call(cctx, page.Navigate, page.NavigateParams{URL: site.url}); err != nil {
		return chromeError(err, "opening the pages")
	}
	if err := waitForPhotos(cctx, fmt.Sprintf(photosCountJS, site.url), report); err != nil {
		return err
	}
	if _, err := chromedp.Run(cctx, chromedp.Evaluate[bool](fontsReadyJS, chromedp.EvalAwaitPromise)); err != nil {
		return fmt.Errorf("waiting for the fonts: %w", err)
	}
	return use(cctx)
}

// chromeError is err from the first step on Chrome's tab, doing: ErrNoChrome
// when Chrome couldn't be started.
func chromeError(err error, doing string) error {
	if errors.Is(err, exec.ErrNotFound) || errors.Is(err, fs.ErrNotExist) {
		return fmt.Errorf("%w: %w", ErrNoChrome, err)
	}
	return fmt.Errorf("%s: %w", doing, err)
}

// allocatorOptions are Chrome's options: headless, as chromedp starts it,
// with CHROME_PATH and CHROME_NO_SANDBOX applied.
func allocatorOptions() []chromedp.ExecAllocatorOption {
	opts := append([]chromedp.ExecAllocatorOption{}, chromedp.DefaultExecAllocatorOptions[:]...)
	if path := os.Getenv("CHROME_PATH"); path != "" {
		opts = append(opts, chromedp.ExecPath(path))
	}
	if os.Getenv("CHROME_NO_SANDBOX") != "" {
		opts = append(opts, chromedp.NoSandbox)
	}
	return opts
}

// pagesSite serves the pages to Chrome, once, from this computer.
type pagesSite struct {
	listener net.Listener
	url      string
}

// servePages serves html at a local address for Chrome to open. Opened from
// there rather than set into a blank tab, the pages may load photos from this
// computer as well as from R2: Chrome blocks a blank tab from reaching
// local addresses.
func servePages(ctx context.Context, html string) (*pagesSite, error) {
	var lc net.ListenConfig
	listener, err := lc.Listen(ctx, "tcp", "127.0.0.1:0")
	if err != nil {
		return nil, fmt.Errorf("serving the pages to Chrome: %w", err)
	}
	server := &http.Server{
		ReadHeaderTimeout: 10 * time.Second,
		Handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			// Chrome reports a page that didn't arrive.
			_, _ = io.WriteString(w, html)
		}),
	}
	// Serve stops with an error when the listener closes, once the PDF is made.
	go func() { _ = server.Serve(listener) }()
	return &pagesSite{listener: listener, url: "http://" + listener.Addr().String() + "/"}, nil
}

// Close stops serving the pages.
func (s *pagesSite) Close() error { return s.listener.Close() }

// waitForPhotos waits until every photo on the page has loaded or failed,
// counting them with countJS and reporting how many have each time it checks.
func waitForPhotos(ctx context.Context, countJS string, report func(Progress)) error {
	for {
		counts, err := chromedp.Run(ctx, chromedp.Evaluate[[2]int](countJS))
		if err != nil {
			return fmt.Errorf("counting the photos: %w", err)
		}
		if counts[1] >= 0 {
			report(Progress{Step: StepPhotos, Done: counts[0], Total: counts[1]})
			if counts[0] >= counts[1] {
				return nil
			}
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(photoCheckEvery):
		}
	}
}

// printPDF prints the page to a PDF at the paper size its @page rule sets,
// with backgrounds, reading it back from Chrome a chunk at a time.
func printPDF(ctx context.Context, _ *chromedp.Target) ([]byte, error) {
	res, err := chromedp.Call(ctx, page.PrintToPDF, page.PrintToPDFParams{
		PrintBackground:   ptr(true),
		PreferCSSPageSize: ptr(true),
		TransferMode:      page.PrintToPDFTransferModeReturnAsStream,
	})
	if err != nil {
		return nil, fmt.Errorf("printing: %w", err)
	}
	defer func() { _, _ = chromedp.Call(ctx, cdpio.Close, cdpio.CloseParams{Handle: res.Stream}) }()
	var pdf []byte
	for {
		chunk, err := chromedp.Call(ctx, cdpio.Read, cdpio.ReadParams{Handle: res.Stream, Size: readChunk})
		if err != nil {
			return nil, fmt.Errorf("reading the PDF: %w", err)
		}
		pdf = append(pdf, chunk.Data...)
		if chunk.EOF {
			return pdf, nil
		}
	}
}

func ptr[T any](v T) *T { return &v }
