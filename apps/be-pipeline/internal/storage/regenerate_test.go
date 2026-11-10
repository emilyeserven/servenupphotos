package storage

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/versions"
)

// fakeR2Regenerate serves original at key's path, answering any other GET
// with status and code, and records every PUT. A HEAD of the thumbnail answers
// with headStatus (404 when unset) and its crop metadata.
type fakeR2Regenerate struct {
	key, original string
	status        int
	code          string
	headStatus    int
	crop          string
	// faces are the faces metadata the thumbnail's HEAD answers with.
	faces string
	heads int
	puts  []string
	// metas are the crop metadata of every PUT, in order.
	metas []string
	// faceMetas are the faces metadata of every PUT, in order.
	faceMetas []string
}

func (f *fakeR2Regenerate) start(t *testing.T) string {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			if r.URL.Path != "/photos/"+f.key || f.status != http.StatusOK {
				writeS3Error(w, f.status, f.code)
				return
			}
			_, _ = io.WriteString(w, f.original)
		case http.MethodHead:
			if want := "/photos/" + VersionKey(f.key, "thumbnail"); r.URL.Path != want {
				t.Errorf("HEAD %s, want %s", r.URL.Path, want)
			}
			f.heads++
			if f.headStatus == 0 {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			w.Header().Set("X-Amz-Meta-Crop", f.crop)
			w.Header().Set("X-Amz-Meta-Faces", f.faces)
			w.WriteHeader(f.headStatus)
		case http.MethodPut:
			body, _ := io.ReadAll(r.Body)
			f.puts = append(f.puts, r.URL.Path+" "+r.Header.Get("Content-Type")+" "+string(body))
			f.metas = append(f.metas, r.Header.Get("X-Amz-Meta-Crop"))
			f.faceMetas = append(f.faceMetas, r.Header.Get("X-Amz-Meta-Faces"))
		default:
			t.Errorf("method = %s, want GET, HEAD or PUT", r.Method)
		}
	}))
	t.Cleanup(srv.Close)
	return srv.URL
}

// fakeEncodeOnly stands in for versions.EncodeOnly, making each of vs from
// whatever it's given, and cutting a thumbnail from crop, or a 10×10 square
// at 0, 0 when crop is nil.
func fakeEncodeOnly(photo io.Reader, vs []versions.Version, crop *versions.Crop, faces versions.Faces) ([]versions.Encoded, error) {
	data, err := io.ReadAll(photo)
	if err != nil {
		return nil, err
	}
	var out []versions.Encoded
	for _, v := range vs {
		e := versions.Encoded{Version: v, Data: append([]byte(v.Name+":"), data...), Faces: faces}
		if versions.IsSquare(v) {
			e.Crop = &versions.Crop{Size: 10}
			if crop != nil {
				e.Crop = crop
			}
		}
		out = append(out, e)
	}
	return out, nil
}

func TestRegenerateVersions(t *testing.T) {
	cfg := validR2
	cfg.PublicURL = "https://pub-123.r2.dev"
	const key = "photos/233d38afbc8e-img-0001.jpg"
	fake := &fakeR2Regenerate{key: key, original: "jpeg", status: http.StatusOK}
	large, _ := versions.Find("large")
	small, _ := versions.Find("small")

	got, err := regenerateVersions(t.Context(), cfg, fake.start(t), key, []versions.Version{large, small}, nil, nil, fakeEncodeOnly)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{
		"/photos/photos/233d38afbc8e-img-0001-large.webp image/webp large:jpeg",
		"/photos/photos/233d38afbc8e-img-0001-small.webp image/webp small:jpeg",
	}
	if !slices.Equal(fake.puts, want) {
		t.Errorf("puts = %q, want %q", fake.puts, want)
	}
	if len(got) != 2 || got["large"].URL != "https://pub-123.r2.dev/photos/233d38afbc8e-img-0001-large.webp" {
		t.Errorf("got %+v", got)
	}
}

func TestRegenerateThumbnailKeepsItsCrop(t *testing.T) {
	cfg := validR2
	cfg.PublicURL = "https://pub-123.r2.dev"
	const key = "photos/233d38afbc8e-img-0001.jpg"
	small, _ := versions.Find("small")
	tests := []struct {
		name       string
		headStatus int
		crop       string
		want       []string
	}{
		{"saved crop", http.StatusOK, "120,40,900", []string{"", "120,40,900"}},
		{"no thumbnail yet", 0, "", []string{"", "0,0,10"}},
		{"no crop saved", http.StatusOK, "", []string{"", "0,0,10"}},
		{"unreadable crop", http.StatusOK, "wide", []string{"", "0,0,10"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := &fakeR2Regenerate{key: key, original: "jpeg", status: http.StatusOK, headStatus: tt.headStatus, crop: tt.crop}
			if _, err := regenerateVersions(t.Context(), cfg, fake.start(t), key, []versions.Version{small, versions.Thumbnail}, nil, nil, fakeEncodeOnly); err != nil {
				t.Fatal(err)
			}
			if !slices.Equal(fake.metas, tt.want) {
				t.Errorf("crop metadata = %q, want %q", fake.metas, tt.want)
			}
		})
	}

	t.Run("thumbnail preview alone", func(t *testing.T) {
		fake := &fakeR2Regenerate{key: key, original: "jpeg", status: http.StatusOK, headStatus: http.StatusOK, crop: "120,40,900"}
		if _, err := regenerateVersions(t.Context(), cfg, fake.start(t), key, []versions.Version{versions.ThumbnailPreview}, nil, nil, fakeEncodeOnly); err != nil {
			t.Fatal(err)
		}
		if want := []string{"120,40,900"}; !slices.Equal(fake.metas, want) {
			t.Errorf("crop metadata = %q, want %q", fake.metas, want)
		}
	})

	t.Run("crop can't be read", func(t *testing.T) {
		fake := &fakeR2Regenerate{key: key, original: "jpeg", status: http.StatusOK, headStatus: http.StatusForbidden}
		_, err := regenerateVersions(t.Context(), cfg, fake.start(t), key, []versions.Version{versions.Thumbnail}, nil, nil, fakeEncodeOnly)
		var uerr *UploadError
		if !errors.As(err, &uerr) || !strings.Contains(uerr.Message, "Square Thumbnail's crop") {
			t.Errorf("err = %v, want an UploadError about the crop", err)
		}
		if len(fake.puts) > 0 {
			t.Errorf("puts = %q, want nothing uploaded", fake.puts)
		}
	})
}

func TestRegenerateThumbnailWithANewCrop(t *testing.T) {
	cfg := validR2
	cfg.PublicURL = "https://pub-123.r2.dev"
	const key = "photos/233d38afbc8e-img-0001.jpg"
	// The saved crop is replaced; only the saved faces are kept.
	fake := &fakeR2Regenerate{key: key, original: "jpeg", status: http.StatusOK, headStatus: http.StatusOK, crop: "1,1,10", faces: "5,5,50,50,8"}
	crop := &versions.Crop{X: 30, Y: 0, Size: 600}
	got, err := regenerateVersions(t.Context(), cfg, fake.start(t), key, []versions.Version{versions.Thumbnail, versions.ThumbnailPreview}, crop, nil, fakeEncodeOnly)
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(fake.metas, []string{"30,0,600", "30,0,600"}) {
		t.Errorf("crop metadata = %q, want the new crop on both squares", fake.metas)
	}
	if !slices.Equal(fake.faceMetas, []string{"5,5,50,50,8", "5,5,50,50,8"}) {
		t.Errorf("faces metadata = %q, want the saved faces kept", fake.faceMetas)
	}
	if got["thumbnail"].URL != "https://pub-123.r2.dev/photos/233d38afbc8e-img-0001-thumbnail.webp" {
		t.Errorf("got %+v", got)
	}
}

func TestThumbnailCrop(t *testing.T) {
	const key = "photos/233d38afbc8e-img-0001.jpg"
	tests := []struct {
		name       string
		headStatus int
		crop       string
		want       *versions.Crop
	}{
		{"saved crop", http.StatusOK, "120,40,900", &versions.Crop{X: 120, Y: 40, Size: 900}},
		{"no thumbnail yet", 0, "", nil},
		{"no crop saved", http.StatusOK, "", nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := &fakeR2Regenerate{key: key, headStatus: tt.headStatus, crop: tt.crop}
			got, err := savedThumbnailCrop(t.Context(), validR2, fake.start(t), key)
			if err != nil {
				t.Fatal(err)
			}
			if (got == nil) != (tt.want == nil) || (got != nil && *got != *tt.want) {
				t.Errorf("crop = %v, want %v", got, tt.want)
			}
		})
	}

	t.Run("not a pipeline photo", func(t *testing.T) {
		_, err := savedThumbnailCrop(t.Context(), validR2, "http://unused.invalid", "other/img.jpg")
		var uerr *UploadError
		if !errors.As(err, &uerr) || !uerr.NotFound {
			t.Errorf("err = %v, want a NotFound UploadError", err)
		}
	})
}

func TestRegenerateVersionsKeepsSavedFaces(t *testing.T) {
	cfg := validR2
	cfg.PublicURL = "https://pub-123.r2.dev"
	const key = "photos/233d38afbc8e-img-0001.jpg"
	const saved = "10,20,300,300,8"
	fake := &fakeR2Regenerate{key: key, original: "jpeg", status: http.StatusOK, headStatus: http.StatusOK, faces: saved}
	small, _ := versions.Find("small")

	if _, err := regenerateVersions(t.Context(), cfg, fake.start(t), key, []versions.Version{small}, nil, nil, fakeEncodeOnly); err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(fake.faceMetas, []string{saved}) {
		t.Errorf("faces metadata = %q, want the saved %q kept", fake.faceMetas, saved)
	}
}

func TestRegenerateVersionsWithNewFacesRemakesEveryVersion(t *testing.T) {
	cfg := validR2
	cfg.PublicURL = "https://pub-123.r2.dev"
	const key = "photos/233d38afbc8e-img-0001.jpg"
	small, _ := versions.Find("small")
	for _, tt := range []struct {
		name  string
		faces versions.Faces
		want  string
	}{
		{"new faces", versions.Faces{{X: 1, Y: 2, Width: 30, Height: 40, Blocks: 6}}, "1,2,30,40,6"},
		{"no faces", versions.Faces{}, ""},
	} {
		t.Run(tt.name, func(t *testing.T) {
			fake := &fakeR2Regenerate{key: key, original: "jpeg", status: http.StatusOK, headStatus: http.StatusOK, crop: "0,0,50", faces: "9,9,9,9,9"}
			got, err := regenerateVersions(t.Context(), cfg, fake.start(t), key, []versions.Version{small}, nil, &tt.faces, fakeEncodeOnly)
			if err != nil {
				t.Fatal(err)
			}
			if len(got) != len(versions.Published()) {
				t.Errorf("remade %d versions, want all %d", len(got), len(versions.Published()))
			}
			for i, meta := range fake.faceMetas {
				if meta != tt.want {
					t.Errorf("PUT %d faces metadata = %q, want %q", i, meta, tt.want)
				}
			}
			// The thumbnail keeps its saved crop.
			if !slices.Contains(fake.metas, "0,0,50") {
				t.Errorf("crop metadata = %q, want the saved crop kept", fake.metas)
			}
		})
	}
}

func TestSavedFaces(t *testing.T) {
	const key = "photos/233d38afbc8e-img-0001.jpg"
	fake := &fakeR2Regenerate{key: key, headStatus: http.StatusOK, faces: "1,2,30,40,6"}
	got, err := savedFaces(t.Context(), validR2, fake.start(t), key)
	if err != nil || got.String() != "1,2,30,40,6" {
		t.Errorf("savedFaces = %v, %v", got, err)
	}
	none := &fakeR2Regenerate{key: key}
	if got, err := savedFaces(t.Context(), validR2, none.start(t), key); err != nil || len(got) != 0 {
		t.Errorf("savedFaces without a thumbnail = %v, %v; want none", got, err)
	}
}

func TestRegenerateVersionsProblems(t *testing.T) {
	cfg := validR2
	cfg.PublicURL = "https://pub-123.r2.dev"
	failEncode := func(io.Reader, []versions.Version, *versions.Crop, versions.Faces) ([]versions.Encoded, error) {
		return nil, errors.New("bad jpeg")
	}
	tests := []struct {
		name     string
		key      string
		status   int
		code     string
		encode   encodeOnlyFunc
		notFound bool
		want     string
	}{
		{"not an upload", "notes.txt", http.StatusOK, "", fakeEncodeOnly, true, "Only photos uploaded"},
		{"a version, not an original", "photos/233d38afbc8e-img-0001-large.webp", http.StatusOK, "", fakeEncodeOnly, true, "Only photos uploaded"},
		{"gone", "photos/233d38afbc8e-img-0001.jpg", http.StatusNotFound, "NoSuchKey", fakeEncodeOnly, true, "isn't in the bucket anymore"},
		{"refused", "photos/233d38afbc8e-img-0001.jpg", http.StatusForbidden, "AccessDenied", fakeEncodeOnly, false, "Couldn't download the original"},
		{"unreadable", "photos/233d38afbc8e-img-0001.jpg", http.StatusOK, "", failEncode, false, "Couldn't read the original JPEG"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := &fakeR2Regenerate{key: "photos/233d38afbc8e-img-0001.jpg", status: tt.status, code: tt.code}
			_, err := regenerateVersions(t.Context(), cfg, fake.start(t), tt.key, versions.All, nil, nil, tt.encode)
			var uerr *UploadError
			if !errors.As(err, &uerr) || uerr.NotFound != tt.notFound || !strings.Contains(uerr.Message, tt.want) {
				t.Errorf("err = %+v, want NotFound %v with %q", err, tt.notFound, tt.want)
			}
			if len(fake.puts) > 0 {
				t.Errorf("puts = %q, want nothing uploaded", fake.puts)
			}
		})
	}
}
