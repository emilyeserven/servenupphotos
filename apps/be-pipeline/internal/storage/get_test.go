package storage

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

// fakeR2Get answers each GET with body, or with status and an S3 error body
// carrying code when status isn't 200.
func fakeR2Get(t *testing.T, status int, code, body string) string {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s, want GET", r.Method)
		}
		if status != http.StatusOK {
			w.Header().Set("Content-Type", "application/xml")
			w.WriteHeader(status)
			_, _ = fmt.Fprintf(w, `<Error><Code>%s</Code><Message>from fake</Message></Error>`, code)
			return
		}
		_, _ = io.WriteString(w, body)
	}))
	t.Cleanup(srv.Close)
	return srv.URL
}

func TestGetPhoto(t *testing.T) {
	body, err := getPhoto(t.Context(), validR2, fakeR2Get(t, http.StatusOK, "", "jpeg bytes"), "photos/233d38afbc8e-img-0001.jpg")
	if err != nil {
		t.Fatal(err)
	}
	defer body.Close() //nolint:errcheck // test
	if got, _ := io.ReadAll(body); string(got) != "jpeg bytes" {
		t.Errorf("body = %q", got)
	}
}

func TestGetPhotoProblems(t *testing.T) {
	tests := []struct {
		name, key string
		status    int
		code      string
		want      GetError
	}{
		{"not a photo", "notes.txt", http.StatusOK, "", GetError{BadKey: true}},
		{"a resized copy", "photos/a-large.webp", http.StatusOK, "", GetError{BadKey: true}},
		{"climbs out", "photos/../a.jpg", http.StatusOK, "", GetError{BadKey: true}},
		{"gone", "photos/a.jpg", http.StatusNotFound, "NoSuchKey", GetError{NotFound: true}},
		{"refused", "photos/a.jpg", http.StatusForbidden, "AccessDenied", GetError{}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := getPhoto(t.Context(), validR2, fakeR2Get(t, tt.status, tt.code, ""), tt.key)
			var gerr *GetError
			if !errors.As(err, &gerr) || gerr.NotFound != tt.want.NotFound || gerr.BadKey != tt.want.BadKey || gerr.Message == "" {
				t.Errorf("err = %#v, want %+v", err, tt.want)
			}
		})
	}
}

func TestOriginalName(t *testing.T) {
	for key, want := range map[string]string{
		"photos/233d38afbc8e-img-0001.jpg": "img-0001.jpg",
		"photos/233d38afbc8e.jpg":          "233d38afbc8e.jpg",
		"elsewhere/DSC0001.JPG":            "DSC0001.JPG",
	} {
		if got := OriginalName(key); got != want {
			t.Errorf("OriginalName(%q) = %q, want %q", key, got, want)
		}
	}
}
