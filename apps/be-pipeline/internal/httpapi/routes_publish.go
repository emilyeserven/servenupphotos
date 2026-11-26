package httpapi

import (
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/bookpdf"
)

// registerPublishRoutes adds the Publish routes: the Instagram calendar and its
// Not Stored posts, combined into NOTSTORED.json, the Photo Book's books,
// combined into PHOTOBOOKS.json, their PDFs and spread images, the Bio page's bio and its self-portraits,
// combined into ALLBIO.json, and the Dashboard's Needs attention, which
// reads the same files cut down.
func registerPublishRoutes(mux *http.ServeMux, d routeDeps) {
	mux.HandleFunc("GET /publish/instagram", handleSocialCalendar(d.store, d.gh))
	mux.HandleFunc("PUT /publish/instagram", handleSetSocialDates(d.store, d.gh))
	mux.HandleFunc("PUT /notstored/{day}", handleSaveNotStoredPost(d.store, d.gh))
	mux.HandleFunc("DELETE /notstored/{day}", handleDeleteNotStoredPost(d.store, d.gh))
	mux.HandleFunc("PUT /photobooks/{id}", handleSavePhotoBook(d.store, d.gh))
	mux.HandleFunc("DELETE /photobooks/{id}", handleDeletePhotoBook(d.store, d.gh))
	pdfs := newPdfProgress()
	mux.HandleFunc("POST /photobooks/{id}/pdf", handleBookPdf(pdfs, bookpdf.Make))
	mux.HandleFunc("GET /photobooks/{id}/pdf/progress", handleBookPdfProgress(pdfs))
	mux.HandleFunc("POST /photobooks/{id}/spread-image", handleSpreadImage(bookpdf.Image))
	mux.HandleFunc("POST /bio/portrait", handleUploadBioPortrait(d.store.R2))
	mux.HandleFunc("PUT /bio/{id}", handleSaveBio(d.store, d.gh))
	mux.HandleFunc("GET /attention", handleAttention(d.store, d.gh))
}
