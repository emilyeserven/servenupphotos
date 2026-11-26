package httpapi

import (
	"archive/zip"
	"bytes"
	"context"
	"fmt"
	"log/slog"
	"mime"
	"net/http"
	"path"
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

// spreadImagesTimeout bounds drawing every spread of a photo book as images:
// loading all their photos' resized versions and drawing each spread.
const spreadImagesTimeout = 10 * time.Minute

// maxSpreadImages is the most spreads Save all as images draws at once.
const maxSpreadImages = 500

// spreadImagesBody is what Save all as images sends: every spread of the
// book, one under another, as the Book tab drew them.
type spreadImagesBody struct {
	// HTML is a whole page holding the spreads one under another from its
	// top left, with the style sheets they're drawn with.
	HTML string `json:"html"`
	// Sheet is one spread's size as drawn and each image's longest side.
	Sheet bookpdf.Sheet `json:"sheet"`
	// Names is what each spread's image is called in the zip, in the
	// spreads' order, such as korea-2026-pages-4-5.webp.
	Names []string `json:"names"`
}

// makeImagesFunc draws html's count sheets as one WEBP image each;
// bookpdf.Images in the app, a fake in tests.
type makeImagesFunc func(ctx context.Context, html string, sheet bookpdf.Sheet, count int, report func(bookpdf.Progress)) ([][]byte, error)

// handleSpreadImages draws every spread sent of the path's photo book as a
// small WEBP image, as handleSpreadImage draws one, and sends them in one zip
// named after the book, saying how far it has got in progress.
func handleSpreadImages(progress *pdfProgress, makeImages makeImagesFunc) http.HandlerFunc {
	return withBody("spreads", maxBookPagesBytes, func(w http.ResponseWriter, r *http.Request, body spreadImagesBody) {
		if !body.Sheet.Valid() || len(body.Names) == 0 || len(body.Names) > maxSpreadImages {
			writeError(w, http.StatusBadRequest, "The spreads' size, the images' size or their names are missing or too large.")
			return
		}
		id := r.PathValue("id")
		ctx, cancel := context.WithTimeout(r.Context(), spreadImagesTimeout)
		defer cancel()
		defer progress.clear(id)
		images, err := makeImages(ctx, body.HTML, body.Sheet, len(body.Names), func(pr bookpdf.Progress) { progress.set(id, pr) })
		if err == nil {
			err = sendImagesZip(w, id, body.Names, images)
		}
		if err != nil {
			status, message := bookPdfError(ctx, err, "the images", spreadImagesTimeout)
			slog.Error("drawing a photo book's spread images failed", "book", id, "err", err)
			writeError(w, status, message)
		}
	})
}

// sendImagesZip zips images, each named by names in turn and stored as they
// are, since a WEBP is already compressed, and sends the zip as a download
// named after the book, such as korea-2026-spreads.zip.
func sendImagesZip(w http.ResponseWriter, id string, names []string, images [][]byte) error {
	if len(images) != len(names) {
		return fmt.Errorf("drew %d images for %d spreads", len(images), len(names))
	}
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for i, img := range images {
		f, err := zw.CreateHeader(&zip.FileHeader{Name: path.Base(names[i]), Method: zip.Store, Modified: time.Now()})
		if err != nil {
			return err
		}
		if _, err := f.Write(img); err != nil {
			return err
		}
	}
	if err := zw.Close(); err != nil {
		return err
	}
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Length", strconv.Itoa(buf.Len()))
	w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": id + "-spreads.zip"}))
	if _, err := w.Write(buf.Bytes()); err != nil {
		slog.Warn("sending a photo book's spread images failed", "book", id, "err", err)
	}
	return nil
}
