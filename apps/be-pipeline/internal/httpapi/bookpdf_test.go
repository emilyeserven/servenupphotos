package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/bookpdf"
)

// bookPdfMux is the PDF routes with makePdf making the PDF.
func bookPdfMux(progress *pdfProgress, makePdf makePdfFunc) *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /photobooks/{id}/pdf", handleBookPdf(progress, makePdf))
	mux.HandleFunc("GET /photobooks/{id}/pdf/progress", handleBookPdfProgress(progress))
	return mux
}

func postBookPdf(t *testing.T, mux http.Handler, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/photobooks/korea-2026/pdf", strings.NewReader(body))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	return rec
}

func readBookPdfProgress(t *testing.T, mux http.Handler) bookPdfProgress {
	t.Helper()
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/photobooks/korea-2026/pdf/progress", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	var got bookPdfProgress
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	return got
}

func TestBookPdfSendsThePdfAndReportsProgress(t *testing.T) {
	progress := newPdfProgress()
	var mux *http.ServeMux
	var during bookPdfProgress
	mux = bookPdfMux(progress, func(_ context.Context, html string, pages int, report func(bookpdf.Progress)) ([]byte, error) {
		if html != "<p>pages</p>" || pages != 72 {
			t.Errorf("got %q and %d pages", html, pages)
		}
		report(bookpdf.Progress{Step: bookpdf.StepPhotos, Done: 3, Total: 90})
		during = readBookPdfProgress(t, mux)
		return []byte("%PDF-1.4 book"), nil
	})
	rec := postBookPdf(t, mux, `{"html":"<p>pages</p>","pages":72}`)
	if rec.Code != http.StatusOK || rec.Body.String() != "%PDF-1.4 book" {
		t.Fatalf("got %d %q", rec.Code, rec.Body.String())
	}
	if got := rec.Header().Get("Content-Disposition"); got != "attachment; filename=korea-2026.pdf" {
		t.Errorf("Content-Disposition %q", got)
	}
	if got := rec.Header().Get("Content-Type"); got != "application/pdf" {
		t.Errorf("Content-Type %q", got)
	}
	want := bookPdfProgress{Running: true, Progress: bookpdf.Progress{Step: bookpdf.StepPhotos, Done: 3, Total: 90}}
	if during != want {
		t.Errorf("progress while making %+v, want %+v", during, want)
	}
	if after := readBookPdfProgress(t, mux); after.Running {
		t.Errorf("progress after %+v, want not running", after)
	}
}

func TestBookPdfErrors(t *testing.T) {
	tests := []struct {
		name   string
		body   string
		err    error
		status int
	}{
		{"no Chrome", `{"html":"x","pages":1}`, bookpdf.ErrNoChrome, http.StatusServiceUnavailable},
		{"Chrome failed", `{"html":"x","pages":1}`, errors.New("crashed"), http.StatusInternalServerError},
		{"unknown field", `{"html":"x","paper":"a4"}`, nil, http.StatusBadRequest},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mux := bookPdfMux(newPdfProgress(), func(context.Context, string, int, func(bookpdf.Progress)) ([]byte, error) {
				return nil, tt.err
			})
			if rec := postBookPdf(t, mux, tt.body); rec.Code != tt.status {
				t.Errorf("got %d %s, want %d", rec.Code, rec.Body.String(), tt.status)
			}
		})
	}
}
