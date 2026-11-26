package httpapi

import (
	"context"
	"errors"
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
