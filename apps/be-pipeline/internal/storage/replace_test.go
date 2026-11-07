package storage

import (
	"io"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
)

// fakeR2Replace records each upload as "PUT key (body)".
func fakeR2Replace(t *testing.T, log *[]string) string {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		*log = append(*log, r.Method+" "+strings.TrimPrefix(r.URL.Path, "/photos/")+" ("+string(body)+")")
	}))
	t.Cleanup(srv.Close)
	return srv.URL
}

func TestReplaceOriginal(t *testing.T) {
	const key = "photos/233d38afbc8e-dsc0001.jpg"
	var log []string
	endpoint := fakeR2Replace(t, &log)
	if msg := replaceOriginal(t.Context(), validR2, endpoint, key, strings.NewReader("edited"), 6); msg != "" {
		t.Fatalf("replaceOriginal() = %q", msg)
	}
	if want := []string{"PUT " + key + " (edited)"}; !slices.Equal(log, want) {
		t.Errorf("requests = %q, want %q", log, want)
	}
}

func TestReplaceOriginalOnlyPipelinePhotos(t *testing.T) {
	msg := replaceOriginal(t.Context(), validR2, "http://unused.invalid", "notes/a.jpg", strings.NewReader(""), 0)
	if !strings.Contains(msg, "uploaded by the pipeline") {
		t.Errorf("replaceOriginal() = %q, want it refused", msg)
	}
}
