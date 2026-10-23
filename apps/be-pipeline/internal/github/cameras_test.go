package github

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/exif"
)

const xt5Override = `{"id":"x-t5","camera":"X-T5","rules":[
  {"when":null,"set":{"camera":"Fujifilm X-T5"}},
  {"when":{"field":"lens","value":"21.0 mm"},"set":{"lens":"7Artisans 21mm","aperture":1.4}}
]}`

func xt5(t *testing.T) []CameraOverride {
	t.Helper()
	var o CameraOverride
	if err := json.Unmarshal([]byte(xt5Override), &o); err != nil {
		t.Fatal(err)
	}
	return []CameraOverride{o}
}

func TestApplyCameraOverrides(t *testing.T) {
	s := exif.Sanitized{Camera: ref("X-T5"), Lens: ref("21.0 mm"), ISO: ref(200)}
	got := ApplyCameraOverrides(xt5(t), s)
	if *got.Camera != "Fujifilm X-T5" || *got.Lens != "7Artisans 21mm" || *got.Aperture != 1.4 || *got.ISO != 200 {
		t.Errorf("ApplyCameraOverrides() = camera %v, lens %v, aperture %v", *got.Camera, *got.Lens, got.Aperture)
	}
	want := map[string]string{"camera": `"X-T5"`, "lens": `"21.0 mm"`, "aperture": "null"}
	if len(got.ExifOriginals) != len(want) {
		t.Errorf("ExifOriginals = %s, want %v", got.ExifOriginals, want)
	}
	for k, v := range want {
		if string(got.ExifOriginals[k]) != v {
			t.Errorf("ExifOriginals[%s] = %s, want %s", k, got.ExifOriginals[k], v)
		}
	}

	// Another lens only gets the camera's name; another camera nothing.
	other := ApplyCameraOverrides(xt5(t), exif.Sanitized{Camera: ref("X-T5"), Lens: ref("XF35mmF1.4 R")})
	if *other.Camera != "Fujifilm X-T5" || *other.Lens != "XF35mmF1.4 R" || other.Aperture != nil {
		t.Errorf("other lens = %v, %v, %v", *other.Camera, *other.Lens, other.Aperture)
	}
	none := ApplyCameraOverrides(xt5(t), exif.Sanitized{Camera: ref("Canon EOS 80D")})
	if *none.Camera != "Canon EOS 80D" || len(none.ExifOriginals) != 0 {
		t.Errorf("other camera = %v, %s", *none.Camera, none.ExifOriginals)
	}
}

func TestSaveCameraOverride(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{})
	o := xt5(t)[0]
	o.Camera = " X-T5 "
	if _, err := c.SaveCameraOverride(t.Context(), placesGH, o); err != nil {
		t.Fatalf("SaveCameraOverride() error = %v", err)
	}
	saved := staged(t, c, dataRoot+"/cameras/x-t5.json")
	if !strings.Contains(saved, `"camera": "X-T5"`) || !strings.Contains(saved, `"aperture": 1.4`) {
		t.Errorf("saved %s", saved)
	}

	tests := []struct {
		name     string
		override CameraOverride
		status   int
	}{
		{"same camera", CameraOverride{ID: "other", Camera: "X-T5"}, http.StatusConflict},
		{"no camera", CameraOverride{ID: "a"}, http.StatusBadRequest},
		{"unknown field", CameraOverride{ID: "a", Camera: "A", Rules: []OverrideRule{{Set: map[string]json.RawMessage{"title": json.RawMessage(`"x"`)}}}}, http.StatusBadRequest},
		{"wrong type", CameraOverride{ID: "a", Camera: "A", Rules: []OverrideRule{{Set: map[string]json.RawMessage{"iso": json.RawMessage(`"high"`)}}}}, http.StatusBadRequest},
		{"nothing set", CameraOverride{ID: "a", Camera: "A", Rules: []OverrideRule{{}}}, http.StatusBadRequest},
	}
	for _, tt := range tests {
		_, err := c.SaveCameraOverride(t.Context(), placesGH, tt.override)
		var perr *PublishError
		if !errors.As(err, &perr) || perr.Status != tt.status {
			t.Errorf("%s: SaveCameraOverride() error = %v, want status %d", tt.name, err, tt.status)
		}
	}

	if _, err := c.DeleteCameraOverride(t.Context(), placesGH, "x-t5"); err != nil {
		t.Errorf("DeleteCameraOverride() error = %v", err)
	}
}

func TestReapplyOverrides(t *testing.T) {
	photos := dataRoot + "/photos/"
	_, c := newMainRepo(t, map[string]string{
		dataRoot + "/cameras/x-t5.json": xt5Override,
		// From before exifOriginals: gets the overrides and the field.
		photos + "a.json": "{\n  \"camera\": \"X-T5\",\n  \"lens\": \"21.0 mm\",\n  \"aperture\": null\n}\n",
		// Already overridden with an older name.
		photos + "b.json": "{\n  \"camera\": \"Fuji X-T5\",\n  \"lens\": \"XF35mmF1.4 R\",\n  \"exifOriginals\": {\"camera\": \"X-T5\"}\n}\n",
		// Another camera, not overridden: unchanged.
		photos + "c.json": "{\n  \"camera\": \"Canon EOS 80D\",\n  \"lens\": \"EF50mm f/1.8 II\"\n}\n",
	})
	preview, err := c.PreviewReapplyOverrides(t.Context(), placesGH)
	if err != nil {
		t.Fatalf("PreviewReapplyOverrides() error = %v", err)
	}
	if preview.PhotoFiles != 3 || len(preview.Files) != 2 || preview.Overrides != 1 {
		t.Fatalf("preview = %+v, want 2 of 3 files", preview)
	}
	if preview.Files[0].Camera != "X-T5" || len(preview.Files[0].Changes) != 4 {
		t.Errorf("a.json changes = %+v, want camera, lens, aperture and exifOriginals", preview.Files[0].Changes)
	}

	result, err := c.ReapplyOverrides(t.Context(), placesGH)
	if err != nil {
		t.Fatalf("ReapplyOverrides() error = %v", err)
	}
	if result.Files != 2 {
		t.Errorf("ReapplyOverrides() = %+v, want 2 files", result)
	}
	b := staged(t, c, photos+"b.json")
	if !strings.Contains(b, `"camera": "Fujifilm X-T5"`) || !strings.Contains(b, `"lens": "XF35mmF1.4 R"`) {
		t.Errorf("b.json = %s", b)
	}
	// Applying them again changes nothing.
	if _, err := c.ReapplyOverrides(t.Context(), placesGH); err == nil {
		t.Error("ReapplyOverrides() again saved changes, want none")
	}
}
