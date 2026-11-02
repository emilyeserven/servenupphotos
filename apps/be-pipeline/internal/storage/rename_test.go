package storage

import (
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
)

// fakeR2Copy holds the keys in has and records every copy into the photos
// bucket, as "source → destination", answering NoSuchKey for a source it
// doesn't hold.
func fakeR2Copy(t *testing.T, has map[string]bool, copies *[]string) string {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		src := r.Header.Get("X-Amz-Copy-Source")
		if r.Method != http.MethodPut || src == "" {
			t.Errorf("%s %s, want a copy", r.Method, r.URL.Path)
		}
		if !has[strings.TrimPrefix(src, "photos/")] {
			writeS3Error(w, http.StatusNotFound, "NoSuchKey")
			return
		}
		*copies = append(*copies, src+" → "+strings.TrimPrefix(r.URL.Path, "/photos/"))
		w.Header().Set("Content-Type", "application/xml")
		_, _ = w.Write([]byte(`<CopyObjectResult><ETag>"x"</ETag></CopyObjectResult>`))
	}))
	t.Cleanup(srv.Close)
	return srv.URL
}

func TestCopyPhoto(t *testing.T) {
	const from, to = "photos/233d38afbc8e-dsc0001.jpg", "photos/233d38afbc8e-amsterdam-canal.jpg"
	has := map[string]bool{from: true, VersionKey(from, "thumbnail"): true, VersionKey(from, "large"): true}
	var copies []string
	if msg := copyPhoto(t.Context(), validR2, fakeR2Copy(t, has, &copies), from, to); msg != "" {
		t.Fatalf("copyPhoto() = %q", msg)
	}
	want := []string{
		"photos/" + from + " → " + to,
		"photos/photos/233d38afbc8e-dsc0001-thumbnail.webp → photos/233d38afbc8e-amsterdam-canal-thumbnail.webp",
		"photos/photos/233d38afbc8e-dsc0001-large.webp → photos/233d38afbc8e-amsterdam-canal-large.webp",
	}
	if !slices.Equal(copies, want) {
		t.Errorf("copies = %q, want %q", copies, want)
	}
}

func TestCopyPhotoProblems(t *testing.T) {
	tests := []struct {
		name, from, to, want string
	}{
		{"missing original", "photos/233d38afbc8e-dsc0001.jpg", "photos/233d38afbc8e-x.jpg", "isn't in the bucket"},
		{"another photo", "photos/233d38afbc8e-dsc0001.jpg", "photos/000000000000-x.jpg", "same photo"},
		{"not an original", "notes/a.jpg", "photos/233d38afbc8e-x.jpg", "uploaded by the pipeline"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var copies []string
			msg := copyPhoto(t.Context(), validR2, fakeR2Copy(t, nil, &copies), tt.from, tt.to)
			if !strings.Contains(msg, tt.want) || len(copies) != 0 {
				t.Errorf("copyPhoto() = %q with copies %q, want one containing %q and none", msg, copies, tt.want)
			}
		})
	}
}

func TestTitleStem(t *testing.T) {
	tests := map[string]string{
		"Amsterdam Canal":                 "amsterdam-canal",
		"Mt. Fuji at dawn!":               "mt-fuji-at-dawn",
		"Café Crème":                      "cafe-creme",
		"경회루 Pavilion (경회루)":              "pavilion",
		"경회루":                             "",
		strings.Repeat("long title ", 10): "long-title-long-title-long-title-long-title-long-title-long",
	}
	for title, want := range tests {
		if got := TitleStem(title); got != want {
			t.Errorf("TitleStem(%q) = %q, want %q", title, got, want)
		}
	}
}

func TestParsePhotoKey(t *testing.T) {
	k, ok := ParsePhotoKey("photos/233d38afbc8e-dsc0001.jpg")
	if !ok || k != (PhotoKey{Hash: "233d38afbc8e", Stem: "dsc0001"}) || k.Key() != "photos/233d38afbc8e-dsc0001.jpg" {
		t.Errorf("ParsePhotoKey() = %+v, %v", k, ok)
	}
	if k, ok := ParsePhotoKey("photos/233d38afbc8e.jpg"); !ok || k.Stem != "" || k.Key() != "photos/233d38afbc8e.jpg" {
		t.Errorf("ParsePhotoKey(no stem) = %+v, %v", k, ok)
	}
	if _, ok := ParsePhotoKey("photos/233d38afbc8e-dsc0001-large.webp"); ok {
		t.Error("ParsePhotoKey(version) = ok, want false")
	}
}
