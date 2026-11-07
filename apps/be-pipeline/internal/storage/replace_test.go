package storage

import (
	"io"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
)

// fakeR2Replace holds the keys in has and records each request as
// "HEAD key", "COPY source → key" or "PUT key (body)".
func fakeR2Replace(t *testing.T, has map[string]bool, log *[]string) string {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := strings.TrimPrefix(r.URL.Path, "/photos/")
		switch src := r.Header.Get("X-Amz-Copy-Source"); {
		case r.Method == http.MethodHead:
			*log = append(*log, "HEAD "+key)
			if !has[key] {
				w.WriteHeader(http.StatusNotFound)
			}
		case src != "":
			*log = append(*log, "COPY "+strings.TrimPrefix(src, "photos/")+" → "+key)
			w.Header().Set("Content-Type", "application/xml")
			_, _ = w.Write([]byte(`<CopyObjectResult><ETag>"x"</ETag></CopyObjectResult>`))
		default:
			body, _ := io.ReadAll(r.Body)
			*log = append(*log, "PUT "+key+" ("+string(body)+")")
		}
	}))
	t.Cleanup(srv.Close)
	return srv.URL
}

func TestReplaceOriginal(t *testing.T) {
	const key = "photos/233d38afbc8e-dsc0001.jpg"
	tests := []struct {
		name string
		has  map[string]bool
		want []string
	}{
		{
			name: "first edit backs up the original",
			has:  map[string]bool{key: true},
			want: []string{
				"HEAD exif-backups/233d38afbc8e-dsc0001.jpg",
				"COPY " + key + " → exif-backups/233d38afbc8e-dsc0001.jpg",
				"PUT " + key + " (edited)",
			},
		},
		{
			name: "a later edit keeps the first backup",
			has:  map[string]bool{key: true, "exif-backups/233d38afbc8e-dsc0001.jpg": true},
			want: []string{
				"HEAD exif-backups/233d38afbc8e-dsc0001.jpg",
				"PUT " + key + " (edited)",
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var log []string
			endpoint := fakeR2Replace(t, tt.has, &log)
			if msg := replaceOriginal(t.Context(), validR2, endpoint, key, strings.NewReader("edited"), 6); msg != "" {
				t.Fatalf("replaceOriginal() = %q", msg)
			}
			if !slices.Equal(log, tt.want) {
				t.Errorf("requests = %q, want %q", log, tt.want)
			}
		})
	}
}

func TestReplaceOriginalOnlyPipelinePhotos(t *testing.T) {
	msg := replaceOriginal(t.Context(), validR2, "http://unused.invalid", "notes/a.jpg", strings.NewReader(""), 0)
	if !strings.Contains(msg, "uploaded by the pipeline") {
		t.Errorf("replaceOriginal() = %q, want it refused", msg)
	}
}
