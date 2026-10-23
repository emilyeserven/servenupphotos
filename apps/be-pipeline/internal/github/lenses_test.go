package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"
)

func TestSaveCustomLens(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{})
	lens := CustomLens{ID: "7artisans-21", Name: " 7Artisans 21mm F1.4 ", FocalLength: ref(21.0), Aperture: ref(1.4), ManualAperture: true}
	if _, err := c.SaveCustomLens(t.Context(), placesGH, lens); err != nil {
		t.Fatalf("SaveCustomLens() error = %v", err)
	}
	saved := staged(t, c, dataRoot+"/lenses/7artisans-21.json")
	// A manual aperture drops the aperture.
	if !strings.Contains(saved, `"name": "7Artisans 21mm F1.4"`) || !strings.Contains(saved, `"aperture": null`) {
		t.Errorf("saved %s", saved)
	}
	tests := []struct {
		name string
		lens CustomLens
	}{
		{"no name", CustomLens{ID: "a"}},
		{"focal length 0", CustomLens{ID: "a", Name: "A", FocalLength: ref(0.0)}},
		{"bad ID", CustomLens{ID: "A A", Name: "A"}},
	}
	for _, tt := range tests {
		_, err := c.SaveCustomLens(t.Context(), placesGH, tt.lens)
		var perr *PublishError
		if !errors.As(err, &perr) || perr.Status != http.StatusBadRequest {
			t.Errorf("%s: SaveCustomLens() error = %v, want 400", tt.name, err)
		}
	}
	_, err := c.SaveCustomLens(t.Context(), placesGH, CustomLens{ID: "other", Name: "7artisans 21MM f1.4"})
	var perr *PublishError
	if !errors.As(err, &perr) || perr.Status != http.StatusConflict {
		t.Errorf("same name: SaveCustomLens() error = %v, want 409", err)
	}
}

func TestReapplyCustomLens(t *testing.T) {
	photos := dataRoot + "/photos/"
	_, c := newMainRepo(t, map[string]string{
		dataRoot + "/lenses/ttartisan-50.json": `{"id":"ttartisan-50","name":"TTArtisan 50mm","focalLength":50,"aperture":null,"manualAperture":true}`,
		photos + "a.json":                      "{\n  \"camera\": \"X-T5\",\n  \"lens\": null,\n  \"aperture\": null,\n  \"focalLength\": null,\n  \"manualAperture\": false,\n  \"customLens\": \"ttartisan-50\"\n}\n",
	})
	if _, err := c.ReapplyOverrides(t.Context(), placesGH); err != nil {
		t.Fatalf("ReapplyOverrides() error = %v", err)
	}
	a := staged(t, c, photos+"a.json")
	for _, want := range []string{`"lens": "TTArtisan 50mm"`, `"focalLength": 50`, `"manualAperture": true`, `"exifOriginals"`} {
		if !strings.Contains(a, want) {
			t.Errorf("a.json = %s, want %s", a, want)
		}
	}
}
