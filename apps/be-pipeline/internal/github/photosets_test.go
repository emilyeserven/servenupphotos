package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"
)

func TestSavePhotoSet(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{
		dataRoot + "/sets/palace.json": `{"id":"palace","name":"Palace","photos":[7]}`,
	})
	set := PhotoSet{ID: "market", Name: " Night market ", Photos: []int{3, 4, 3}}
	if _, err := c.SavePhotoSet(t.Context(), placesGH, set); err != nil {
		t.Fatalf("SavePhotoSet() error = %v", err)
	}
	saved := staged(t, c, dataRoot+"/sets/market.json")
	// The name is trimmed and each photo is listed once.
	if !strings.Contains(saved, `"name": "Night market"`) || strings.Count(saved, "3") != 1 {
		t.Errorf("saved %s, want the trimmed name and photo 3 once", saved)
	}
	tests := []struct {
		name   string
		set    PhotoSet
		status int
	}{
		{"bad id", PhotoSet{ID: "Market!", Name: "Market"}, http.StatusBadRequest},
		{"no name", PhotoSet{ID: "market"}, http.StatusBadRequest},
		{"bad photo", PhotoSet{ID: "market", Name: "Market", Photos: []int{0}}, http.StatusBadRequest},
		{"photo in another set", PhotoSet{ID: "market", Name: "Market", Photos: []int{3, 7}}, http.StatusConflict},
	}
	for _, tt := range tests {
		_, err := c.SavePhotoSet(t.Context(), placesGH, tt.set)
		var perr *PublishError
		if !errors.As(err, &perr) || perr.Status != tt.status {
			t.Errorf("%s: SavePhotoSet() error = %v, want %d", tt.name, err, tt.status)
		}
	}
	// Saving a set again with its own photos is fine.
	if _, err := c.SavePhotoSet(t.Context(), placesGH, PhotoSet{ID: "palace", Name: "Palace", Photos: []int{7, 8}}); err != nil {
		t.Errorf("SavePhotoSet() again error = %v", err)
	}
}

func TestDeletePhotoSet(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{
		dataRoot + "/sets/palace.json": `{"id":"palace","name":"Palace","photos":[7]}`,
	})
	result, err := c.DeletePhotoSet(t.Context(), placesGH, "palace")
	if err != nil || !result.Changed {
		t.Fatalf("DeletePhotoSet() = %+v, %v", result, err)
	}
}
