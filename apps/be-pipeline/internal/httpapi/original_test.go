package httpapi

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

func TestOriginal(t *testing.T) {
	cfg := func() (settings.R2, error) { return settings.R2{Bucket: "photos"}, nil }
	photo := []byte("\xff\xd8\xff jpeg bytes")
	found := func(_ context.Context, _ settings.R2, key string) (io.ReadCloser, error) {
		if key != "photos/233d38afbc8e-dscf4800.jpg" {
			return nil, &storage.GetError{Message: "isn't in the bucket", NotFound: true}
		}
		return io.NopCloser(bytes.NewReader(photo)), nil
	}
	tests := []struct {
		name, query string
		status      int
		disposition string
	}{
		{"named", "?key=photos/233d38afbc8e-dscf4800.jpg&name=DSCF4800.JPG", http.StatusOK, `attachment; filename=DSCF4800.JPG`},
		{"key's name", "?key=photos/233d38afbc8e-dscf4800.jpg", http.StatusOK, `attachment; filename=dscf4800.jpg`},
		{"not a jpeg name", "?key=photos/233d38afbc8e-dscf4800.jpg&name=../notes.txt", http.StatusOK, `attachment; filename=dscf4800.jpg`},
		{"no key", "", http.StatusBadRequest, ""},
		{"gone", "?key=photos/a.jpg", http.StatusNotFound, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/photos/original"+tt.query, nil)
			rec := httptest.NewRecorder()
			handleOriginal(cfg, found)(rec, req)
			if rec.Code != tt.status {
				t.Fatalf("status = %d, body %s; want %d", rec.Code, rec.Body, tt.status)
			}
			if tt.status != http.StatusOK {
				return
			}
			if got := rec.Header().Get("Content-Disposition"); got != tt.disposition {
				t.Errorf("Content-Disposition = %q; want %q", got, tt.disposition)
			}
			if !bytes.Equal(rec.Body.Bytes(), photo) {
				t.Errorf("body = %q; want the photo", rec.Body.Bytes())
			}
		})
	}
}
