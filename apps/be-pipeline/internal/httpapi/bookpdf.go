package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"mime"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/bookpdf"
)

// bookPdfTimeout bounds making one photo book's PDF: loading every page's
// photos at print size and printing them.
const bookPdfTimeout = 15 * time.Minute

// maxBookPagesBytes is the most a book's pages sent for its PDF may weigh:
// their HTML and the pipeline's style sheets.
const maxBookPagesBytes = 64 << 20

// bookPdfBody is what Save as PDF sends: the book's pages as the Book tab
// drew them.
type bookPdfBody struct {
	// HTML is a whole page holding the book's pages, with the style sheets
	// they're drawn with and an @page rule setting the paper size.
	HTML string `json:"html"`
	// Pages is how many pages the PDF has, to say while it prints.
	Pages int `json:"pages"`
}

// makePdfFunc prints html to a PDF of pages pages, telling report how far it
// has got; bookpdf.Make in the app, a fake in tests.
type makePdfFunc func(ctx context.Context, html string, pages int, report func(bookpdf.Progress)) ([]byte, error)

// bookPdfProgress is how far a book's PDF has got; Running is false when
// none is being made.
type bookPdfProgress struct {
	Running bool `json:"running"`
	bookpdf.Progress
}

// pdfProgress keeps how far each book's PDF has got, by book ID, so Save as
// PDF can ask while it's made.
type pdfProgress struct {
	mu     sync.Mutex
	byBook map[string]bookpdf.Progress
}

func newPdfProgress() *pdfProgress {
	return &pdfProgress{byBook: map[string]bookpdf.Progress{}}
}

func (p *pdfProgress) set(id string, pr bookpdf.Progress) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.byBook[id] = pr
}

func (p *pdfProgress) clear(id string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	delete(p.byBook, id)
}

func (p *pdfProgress) get(id string) bookPdfProgress {
	p.mu.Lock()
	defer p.mu.Unlock()
	pr, ok := p.byBook[id]
	return bookPdfProgress{Running: ok, Progress: pr}
}

// handleBookPdf makes the path's photo book's PDF from the pages sent, with
// a headless Chrome, and sends it as a download named after the book.
func handleBookPdf(progress *pdfProgress, makePdf makePdfFunc) http.HandlerFunc {
	return withBody("book's pages", maxBookPagesBytes, func(w http.ResponseWriter, r *http.Request, body bookPdfBody) {
		id := r.PathValue("id")
		ctx, cancel := context.WithTimeout(r.Context(), bookPdfTimeout)
		defer cancel()
		defer progress.clear(id)
		pdf, err := makePdf(ctx, body.HTML, body.Pages, func(pr bookpdf.Progress) { progress.set(id, pr) })
		if err != nil {
			status, message := bookPdfError(ctx, err)
			slog.Error("making a photo book's PDF failed", "book", id, "err", err)
			writeError(w, status, message)
			return
		}
		w.Header().Set("Content-Type", "application/pdf")
		w.Header().Set("Content-Length", strconv.Itoa(len(pdf)))
		w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": id + ".pdf"}))
		if _, err := w.Write(pdf); err != nil {
			slog.Warn("sending a photo book's PDF failed", "book", id, "err", err)
		}
	})
}

// bookPdfError is the status and message for err from making a PDF under
// ctx.
func bookPdfError(ctx context.Context, err error) (int, string) {
	switch {
	case errors.Is(err, bookpdf.ErrNoChrome):
		return http.StatusServiceUnavailable, "Couldn't start Chrome to make the PDF. Install Google Chrome, or set CHROME_PATH to a Chrome or Chromium, and restart the pipeline."
	case errors.Is(ctx.Err(), context.DeadlineExceeded):
		return http.StatusGatewayTimeout, "Making the PDF took longer than " + bookPdfTimeout.String() + ", so it was stopped. Try again, or take some pages out."
	default:
		return http.StatusInternalServerError, "Couldn't make the PDF (" + err.Error() + ")."
	}
}

// handleBookPdfProgress answers how far the path's photo book's PDF has got.
func handleBookPdfProgress(progress *pdfProgress) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, progress.get(r.PathValue("id")))
	}
}
