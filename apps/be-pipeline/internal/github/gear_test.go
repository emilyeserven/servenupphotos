package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"
)

func TestSaveGear(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{
		dataRoot + "/gear/x-t5.json": `{"id":"x-t5","kind":"camera","name":"Fujifilm X-T5","image":"https://cdn.example/gear/a.webp","description":""}`,
	})
	lens := Gear{ID: "xf35", Kind: "lens", Name: " XF35mmF1.4 R ", Image: "https://cdn.example/gear/b.webp", Description: " My first prime. "}
	if _, err := c.SaveGear(t.Context(), placesGH, lens); err != nil {
		t.Fatalf("SaveGear() error = %v", err)
	}
	saved := staged(t, c, dataRoot+"/gear/xf35.json")
	if !strings.Contains(saved, `"name": "XF35mmF1.4 R"`) || !strings.Contains(saved, `"description": "My first prime."`) || !strings.Contains(saved, `"kind": "lens"`) {
		t.Errorf("saved %s", saved)
	}
	// A lens can share a camera's name; only the same kind and name clash.
	if _, err := c.SaveGear(t.Context(), placesGH, Gear{ID: "odd", Kind: "lens", Name: "Fujifilm X-T5", Description: "A lens named like a camera."}); err != nil {
		t.Errorf("SaveGear(lens named like a camera) error = %v", err)
	}
	cropped := Gear{
		ID: "x100", Kind: "camera", Name: "Fujifilm X100V", Image: "https://cdn.example/gear/c.webp",
		Original: "https://cdn.example/gear/originals/c.png", Crop: &GearCrop{X: -0.1, Y: 0, Width: 1.2, Height: 0.9},
	}
	if _, err := c.SaveGear(t.Context(), placesGH, cropped); err != nil {
		t.Fatalf("SaveGear(cropped) error = %v", err)
	}
	if saved := staged(t, c, dataRoot+"/gear/x100.json"); !strings.Contains(saved, `"original": "https://cdn.example/gear/originals/c.png"`) || !strings.Contains(saved, `"width": 1.2`) {
		t.Errorf("saved %s, want its original and crop", saved)
	}
	tests := []struct {
		name   string
		gear   Gear
		status int
	}{
		{"same camera", Gear{ID: "other", Kind: "camera", Name: "fujifilm x-t5", Image: "https://cdn.example/c.webp"}, http.StatusConflict},
		{"no name", Gear{ID: "a", Kind: "camera", Image: "https://cdn.example/c.webp"}, http.StatusBadRequest},
		{"odd kind", Gear{ID: "a", Kind: "tripod", Name: "A", Image: "https://cdn.example/c.webp"}, http.StatusBadRequest},
		{"nothing to show", Gear{ID: "a", Kind: "camera", Name: "A"}, http.StatusBadRequest},
		{"not a link", Gear{ID: "a", Kind: "camera", Name: "A", Image: "gear/c.webp"}, http.StatusBadRequest},
		{"original without a crop", Gear{ID: "a", Kind: "camera", Name: "A", Image: "https://cdn.example/c.webp", Original: "https://cdn.example/o.png"}, http.StatusBadRequest},
		{"crop without an original", Gear{ID: "a", Kind: "camera", Name: "A", Image: "https://cdn.example/c.webp", Crop: &GearCrop{Width: 1, Height: 1}}, http.StatusBadRequest},
		{"bad ID", Gear{ID: "A A", Kind: "camera", Name: "A", Image: "https://cdn.example/c.webp"}, http.StatusBadRequest},
	}
	for _, tt := range tests {
		_, err := c.SaveGear(t.Context(), placesGH, tt.gear)
		var perr *PublishError
		if !errors.As(err, &perr) || perr.Status != tt.status {
			t.Errorf("%s: SaveGear() error = %v, want %d", tt.name, err, tt.status)
		}
	}
}

func TestDeleteGear(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{
		dataRoot + "/gear/x-t5.json": `{"id":"x-t5","kind":"camera","name":"Fujifilm X-T5","image":"https://cdn.example/gear/a.webp","description":""}`,
	})
	got, err := c.DeleteGear(t.Context(), placesGH, "x-t5")
	if err != nil || !got.Changed {
		t.Fatalf("DeleteGear() = %+v, %v; want it removed", got, err)
	}
	var perr *PublishError
	if _, err := c.DeleteGear(t.Context(), placesGH, "nope"); !errors.As(err, &perr) || perr.Status != http.StatusNotFound {
		t.Errorf("DeleteGear(missing) error = %v, want 404", err)
	}
}
