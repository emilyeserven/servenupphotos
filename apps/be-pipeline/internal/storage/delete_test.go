package storage

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// fakeR2Delete records the path of the one DELETE it receives and answers
// with status and, for errors, an S3 error body carrying code.
func fakeR2Delete(t *testing.T, status int, code string, path *string) string {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Errorf("method = %s, want DELETE", r.Method)
		}
		*path = r.URL.Path
		if status != http.StatusNoContent {
			w.Header().Set("Content-Type", "application/xml")
			w.WriteHeader(status)
			_, _ = fmt.Fprintf(w, `<Error><Code>%s</Code><Message>from fake</Message></Error>`, code)
			return
		}
		w.WriteHeader(status)
	}))
	t.Cleanup(srv.Close)
	return srv.URL
}

func TestDeletePhoto(t *testing.T) {
	var path string
	const key = "photos/233d38afbc8e-img-0001.jpg"
	if msg := deletePhoto(t.Context(), validR2, fakeR2Delete(t, http.StatusNoContent, "", &path), key); msg != "" {
		t.Fatalf("msg = %q", msg)
	}
	if path != "/photos/"+key {
		t.Errorf("DELETE path = %q, want the key in the photos bucket", path)
	}
}

func TestDeletePhotoProblems(t *testing.T) {
	var path string
	tests := []struct {
		name, key string
		status    int
		code      string
		want      string
	}{
		{"not a photo", "notes.txt", http.StatusNoContent, "", "Only uploaded photos"},
		{"climbs out", "photos/../notes.txt", http.StatusNoContent, "", "Only uploaded photos"},
		{"read only token", "photos/a.jpg", http.StatusForbidden, "AccessDenied", "isn't allowed to delete"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			path = ""
			msg := deletePhoto(t.Context(), validR2, fakeR2Delete(t, tt.status, tt.code, &path), tt.key)
			if !strings.Contains(msg, tt.want) {
				t.Errorf("msg = %q, want %q", msg, tt.want)
			}
			if tt.code == "" && path != "" {
				t.Errorf("deleted %q, want no request", path)
			}
		})
	}
}
