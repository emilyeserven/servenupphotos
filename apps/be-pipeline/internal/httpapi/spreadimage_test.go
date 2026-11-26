package httpapi

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/bookpdf"
)

func postSpreadImage(t *testing.T, makeImage makeImageFunc, body string) *httptest.ResponseRecorder {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("POST /photobooks/{id}/spread-image", handleSpreadImage(makeImage))
	req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/photobooks/korea-2026/spread-image", strings.NewReader(body))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	return rec
}

func TestSpreadImageSendsTheImage(t *testing.T) {
	want := bookpdf.Sheet{Width: 1536, Height: 960, Longest: 1568}
	rec := postSpreadImage(t, func(_ context.Context, html string, sheet bookpdf.Sheet, _ func(bookpdf.Progress)) ([]byte, error) {
		if html != "<p>spread</p>" || sheet != want {
			t.Errorf("got %q and %+v", html, sheet)
		}
		return []byte("RIFF....WEBP"), nil
	}, `{"html":"<p>spread</p>","sheet":{"width":1536,"height":960,"longest":1568},"name":"korea-2026-pages-4-5.webp"}`)
	if rec.Code != http.StatusOK || rec.Body.String() != "RIFF....WEBP" {
		t.Fatalf("got %d %q", rec.Code, rec.Body.String())
	}
	if got := rec.Header().Get("Content-Type"); got != "image/webp" {
		t.Errorf("Content-Type %q", got)
	}
	if got := rec.Header().Get("Content-Disposition"); got != "attachment; filename=korea-2026-pages-4-5.webp" {
		t.Errorf("Content-Disposition %q", got)
	}
}

func TestSpreadImageErrors(t *testing.T) {
	sheet := `"sheet":{"width":1536,"height":960,"longest":1568}`
	tests := []struct {
		name   string
		body   string
		err    error
		status int
	}{
		{"no Chrome", `{"html":"x",` + sheet + `}`, bookpdf.ErrNoChrome, http.StatusServiceUnavailable},
		{"Chrome failed", `{"html":"x",` + sheet + `}`, errors.New("crashed"), http.StatusInternalServerError},
		{"no size", `{"html":"x"}`, nil, http.StatusBadRequest},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := postSpreadImage(t, func(context.Context, string, bookpdf.Sheet, func(bookpdf.Progress)) ([]byte, error) {
				return nil, tt.err
			}, tt.body)
			if rec.Code != tt.status {
				t.Errorf("got %d %s, want %d", rec.Code, rec.Body.String(), tt.status)
			}
		})
	}
}

func TestSpreadImagesSendsAZipAndReportsProgress(t *testing.T) {
	progress := newPdfProgress()
	mux := http.NewServeMux()
	var during bookPdfProgress
	mux.HandleFunc("GET /photobooks/{id}/spread-images/progress", handleBookPdfProgress(progress))
	mux.HandleFunc("POST /photobooks/{id}/spread-images", handleSpreadImages(progress, func(_ context.Context, html string, _ bookpdf.Sheet, count int, report func(bookpdf.Progress)) ([][]byte, error) {
		if html != "<p>spreads</p>" || count != 2 {
			t.Errorf("got %q and %d spreads", html, count)
		}
		report(bookpdf.Progress{Step: bookpdf.StepDrawing, Done: 1, Total: 2})
		during = progress.get("korea-2026")
		return [][]byte{[]byte("first"), []byte("second")}, nil
	}))
	body := `{"html":"<p>spreads</p>","sheet":{"width":1536,"height":960,"longest":1568},"names":["korea-2026-page-1.webp","korea-2026-pages-2-3.webp"]}`
	req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/photobooks/korea-2026/spread-images", strings.NewReader(body))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("got %d %s", rec.Code, rec.Body.String())
	}
	if got := rec.Header().Get("Content-Disposition"); got != "attachment; filename=korea-2026-spreads.zip" {
		t.Errorf("Content-Disposition %q", got)
	}
	zr, err := zip.NewReader(bytes.NewReader(rec.Body.Bytes()), int64(rec.Body.Len()))
	if err != nil {
		t.Fatal(err)
	}
	var got []string
	for _, f := range zr.File {
		r, err := f.Open()
		if err != nil {
			t.Fatal(err)
		}
		data, _ := io.ReadAll(r)
		got = append(got, f.Name+"="+string(data))
	}
	if want := "korea-2026-page-1.webp=first korea-2026-pages-2-3.webp=second"; strings.Join(got, " ") != want {
		t.Errorf("zip holds %v, want %s", got, want)
	}
	if !during.Running || during.Step != bookpdf.StepDrawing || during.Done != 1 {
		t.Errorf("progress while drawing %+v", during)
	}
	if progress.get("korea-2026").Running {
		t.Error("progress still running after")
	}
}

func TestSpreadImagesNeedsNames(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /photobooks/{id}/spread-images", handleSpreadImages(newPdfProgress(), nil))
	body := `{"html":"x","sheet":{"width":1536,"height":960,"longest":1568}}`
	req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/photobooks/korea-2026/spread-images", strings.NewReader(body))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("got %d, want 400", rec.Code)
	}
}
