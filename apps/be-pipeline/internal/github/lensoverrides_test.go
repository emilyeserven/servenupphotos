package github

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/exif"
)

const xf23Override = `{"id":"xf23mmf1-4-r","lens":"XF23mmF1.4 R","rules":[
  {"when":null,"set":{"lens":"Fujinon XF 23mm F1.4 R","aperture":2}},
  {"when":{"field":"camera","value":"X-E4"},"set":{"iso":400}}
]}`

func xf23(t *testing.T) []LensOverride {
	t.Helper()
	var o LensOverride
	if err := json.Unmarshal([]byte(xf23Override), &o); err != nil {
		t.Fatal(err)
	}
	return []LensOverride{o}
}

func TestApplyLensOverrides(t *testing.T) {
	// Any camera gets the lens's rules; the camera's own override comes after
	// them, so its aperture wins.
	cameraRule := `{"id":"x-t5","camera":"X-T5","rules":[
	  {"when":{"field":"lens","value":"XF23mmF1.4 R"},"set":{"aperture":1.4}}
	]}`
	var cam CameraOverride
	if err := json.Unmarshal([]byte(cameraRule), &cam); err != nil {
		t.Fatal(err)
	}
	o := Overrides{Cameras: []CameraOverride{cam}, Lenses: xf23(t)}
	got := ApplyOverrides(o, exif.Sanitized{Camera: ref("X-T5"), Lens: ref("XF23mmF1.4 R")})
	if *got.Lens != "Fujinon XF 23mm F1.4 R" || *got.Aperture != 1.4 || got.ISO != nil {
		t.Errorf("X-T5 = lens %v, aperture %v, iso %v", *got.Lens, *got.Aperture, got.ISO)
	}
	// A rule limited to a camera only applies to it.
	e4 := ApplyOverrides(o, exif.Sanitized{Camera: ref("X-E4"), Lens: ref("XF23mmF1.4 R")})
	if *e4.Lens != "Fujinon XF 23mm F1.4 R" || *e4.Aperture != 2 || *e4.ISO != 400 {
		t.Errorf("X-E4 = lens %v, aperture %v, iso %v", *e4.Lens, e4.Aperture, e4.ISO)
	}
	if string(e4.ExifOriginals["lens"]) != `"XF23mmF1.4 R"` {
		t.Errorf("ExifOriginals = %s", e4.ExifOriginals)
	}
	other := ApplyOverrides(o, exif.Sanitized{Camera: ref("X-E4"), Lens: ref("XF35mmF1.4 R")})
	if *other.Lens != "XF35mmF1.4 R" || len(other.ExifOriginals) != 0 {
		t.Errorf("other lens = %v, %s", *other.Lens, other.ExifOriginals)
	}
}

func TestSaveLensOverride(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{})
	o := xf23(t)[0]
	o.Lens = " XF23mmF1.4 R "
	if _, err := c.SaveLensOverride(t.Context(), placesGH, o); err != nil {
		t.Fatalf("SaveLensOverride() error = %v", err)
	}
	if saved := staged(t, c, dataRoot+"/lensoverrides/xf23mmf1-4-r.json"); !strings.Contains(saved, `"lens": "XF23mmF1.4 R"`) {
		t.Errorf("saved = %s", saved)
	}
	for _, tt := range []struct {
		name     string
		override LensOverride
		status   int
	}{
		{"same lens", LensOverride{ID: "other", Lens: "XF23mmF1.4 R"}, http.StatusConflict},
		{"no lens", LensOverride{ID: "a"}, http.StatusBadRequest},
		{"wrong type", LensOverride{ID: "a", Lens: "A", Rules: []OverrideRule{{Set: map[string]json.RawMessage{"iso": json.RawMessage(`"high"`)}}}}, http.StatusBadRequest},
	} {
		_, err := c.SaveLensOverride(t.Context(), placesGH, tt.override)
		var perr *PublishError
		if !errors.As(err, &perr) || perr.Status != tt.status {
			t.Errorf("%s: SaveLensOverride() error = %v, want status %d", tt.name, err, tt.status)
		}
	}
	if _, err := c.DeleteLensOverride(t.Context(), placesGH, "xf23mmf1-4-r"); err != nil {
		t.Errorf("DeleteLensOverride() error = %v", err)
	}
}

func TestReapplyLensOverrides(t *testing.T) {
	photos := dataRoot + "/photos/"
	_, c := newMainRepo(t, map[string]string{
		dataRoot + "/lensoverrides/xf23mmf1-4-r.json": xf23Override,
		photos + "a.json": "{\n  \"camera\": \"X-T5\",\n  \"lens\": \"XF23mmF1.4 R\",\n  \"aperture\": 1.4\n}\n",
		photos + "b.json": "{\n  \"camera\": \"X-T5\",\n  \"lens\": \"XF35mmF1.4 R\"\n}\n",
	})
	preview, err := c.PreviewReapplyOverrides(t.Context(), placesGH)
	if err != nil {
		t.Fatalf("PreviewReapplyOverrides() error = %v", err)
	}
	if len(preview.Files) != 1 || preview.Overrides != 1 || preview.Files[0].Path != photos+"a.json" {
		t.Fatalf("preview = %+v, want a.json only", preview)
	}
	if _, err := c.ReapplyOverrides(t.Context(), placesGH); err != nil {
		t.Fatalf("ReapplyOverrides() error = %v", err)
	}
	if a := staged(t, c, photos+"a.json"); !strings.Contains(a, `"lens": "Fujinon XF 23mm F1.4 R"`) {
		t.Errorf("a.json = %s", a)
	}
}
