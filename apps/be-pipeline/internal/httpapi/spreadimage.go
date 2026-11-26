package httpapi

import (
	"context"
	"log/slog"
	"mime"
	"net/http"
	"strconv"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/bookpdf"
)

// spreadImageTimeout bounds drawing one spread of a photo book as an image:
// loading its photos' resized versions and drawing it.
const spreadImageTimeout = 2 * time.Minute

// spreadImageBody is what Save spread as image sends: the two pages shown in
// the Book tab's preview, as it drew them.
type spreadImageBody struct {
	// HTML is a whole page holding the spread at its top left, with the
	// style sheets it's drawn with.
	HTML string `json:"html"`
	// Sheet is the spread's size as drawn and the image's longest side.
	Sheet bookpdf.Sheet `json:"sheet"`
	// Name is what the downloaded image is called, such as
	// korea-2026-pages-4-5.webp.
	Name string `json:"name"`
}

// makeImageFunc draws html as a WEBP image of sheet's size; bookpdf.Image
// in the app, a fake in tests.
type makeImageFunc func(ctx context.Context, html string, sheet bookpdf.Sheet, report func(bookpdf.Progress)) ([]byte, error)

// handleSpreadImage draws the spread sent of the path's photo book as a small
// WEBP image with a headless Chrome, each photo its resized version, and
// sends it as a download, to paste into an LLM for feedback.
func handleSpreadImage(makeImage makeImageFunc) http.HandlerFunc {
	return withBody("spread", maxBookPagesBytes, func(w http.ResponseWriter, r *http.Request, body spreadImageBody) {
		if !body.Sheet.Valid() {
			writeError(w, http.StatusBadRequest, "The spread's size or the image's size is missing or too large.")
			return
		}
		id := r.PathValue("id")
		ctx, cancel := context.WithTimeout(r.Context(), spreadImageTimeout)
		defer cancel()
		img, err := makeImage(ctx, body.HTML, body.Sheet, func(bookpdf.Progress) {})
		if err != nil {
			status, message := bookPdfError(ctx, err, "the image", spreadImageTimeout)
			slog.Error("drawing a photo book spread's image failed", "book", id, "err", err)
			writeError(w, status, message)
			return
		}
		name := body.Name
		if name == "" {
			name = id + ".webp"
		}
		w.Header().Set("Content-Type", "image/webp")
		w.Header().Set("Content-Length", strconv.Itoa(len(img)))
		w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": name}))
		if _, err := w.Write(img); err != nil {
			slog.Warn("sending a photo book spread's image failed", "book", id, "err", err)
		}
	})
}
