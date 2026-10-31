package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"
)

// albumTreeRepo starts a fake repo whose photo data pull request has the albums
// asia, korea (in asia, with an order, covers and a layout) and seoul (in
// korea), and photos 1 and 2 in korea and 3 in seoul.
func albumTreeRepo(t *testing.T) (*fakeGitHub, *Client) {
	t.Helper()
	f, c := newFakeGitHub(t)
	f.openPull(prBranch, map[string]string{
		photosDir + "ALLPHOTOS.json":   "[]\n",
		photosDir + "a.json":           "{\n  \"id\": 1,\n  \"albums\": [\n    \"korea\",\n    \"asia\"\n  ]\n}\n",
		photosDir + "b.json":           "{\n  \"id\": 2,\n  \"albums\": [\n    \"korea\"\n  ]\n}\n",
		photosDir + "c.json":           "{\n  \"id\": 3,\n  \"albums\": [\n    \"seoul\"\n  ]\n}\n",
		dataRoot + "/albums/asia.json": "{\n  \"id\": \"asia\",\n  \"name\": \"Asia\",\n  \"parent\": null\n}\n",
		dataRoot + "/albums/korea.json": "{\n  \"id\": \"korea\",\n  \"name\": \"Korea\",\n  \"parent\": \"asia\",\n" +
			"  \"photoOrder\": [2, 1],\n  \"covers\": [1],\n" +
			"  \"layout\": [{\"textAbove\":\"\",\"photos\":[1],\"textBelow\":\"\"},{\"textAbove\":\"Day two\",\"photos\":[1,2],\"textBelow\":\"\"}]\n}\n",
		dataRoot + "/albums/seoul.json": "{\n  \"id\": \"seoul\",\n  \"name\": \"Seoul\",\n  \"parent\": \"korea\"\n}\n",
	})
	return f, c
}

func TestDeleteAlbum(t *testing.T) {
	f, c := albumTreeRepo(t)
	got, err := c.DeleteAlbum(t.Context(), baseURLSettings, "korea")
	if err != nil {
		t.Fatalf("DeleteAlbum() error = %v", err)
	}
	if got.Photos != 2 || got.Reparented != 1 {
		t.Errorf("DeleteAlbum() = %+v, want 2 photos and 1 album moved", got)
	}
	if w := f.writes(); len(w) != 0 {
		t.Errorf("DeleteAlbum() wrote to GitHub: %v", w)
	}
	if korea, ok := stagedContent(t, c, dataRoot+"/albums/korea.json"); !ok || !korea.Deleted {
		t.Errorf("korea.json = %+v, want deleted", korea)
	}
	if seoul, _ := stagedContent(t, c, dataRoot+"/albums/seoul.json"); !strings.Contains(seoul.Content, `"parent": "asia"`) {
		t.Errorf("seoul.json = %q, want it moved up into asia", seoul.Content)
	}
	if a, _ := stagedContent(t, c, photosDir+"a.json"); a.Content != "{\n  \"id\": 1,\n  \"albums\": [\n    \"asia\"\n  ]\n}\n" {
		t.Errorf("a.json = %q, want only asia", a.Content)
	}
	if b, _ := stagedContent(t, c, photosDir+"b.json"); !strings.Contains(b.Content, `"albums": []`) {
		t.Errorf("b.json = %q, want no albums", b.Content)
	}
	if _, ok := stagedContent(t, c, photosDir+"c.json"); ok {
		t.Error("c.json changed, want it kept in seoul")
	}

	_, err = c.DeleteAlbum(t.Context(), baseURLSettings, "korea")
	var perr *PublishError
	if !errors.As(err, &perr) || perr.Status != http.StatusNotFound {
		t.Errorf("DeleteAlbum(again) error = %v, want not found", err)
	}
}

func TestRemoveAlbumPhotos(t *testing.T) {
	f, c := albumTreeRepo(t)
	got, err := c.RemoveAlbumPhotos(t.Context(), baseURLSettings, "korea", []int{1})
	if err != nil {
		t.Fatalf("RemoveAlbumPhotos() error = %v", err)
	}
	if got.Photos != 1 {
		t.Errorf("RemoveAlbumPhotos() = %+v, want 1 photo", got)
	}
	if w := f.writes(); len(w) != 0 {
		t.Errorf("RemoveAlbumPhotos() wrote to GitHub: %v", w)
	}
	if a, _ := stagedContent(t, c, photosDir+"a.json"); !strings.Contains(a.Content, "\"albums\": [\n    \"asia\"\n  ]") {
		t.Errorf("a.json = %q, want it kept in asia only", a.Content)
	}
	korea, _ := stagedContent(t, c, dataRoot+"/albums/korea.json")
	for _, want := range []string{`"photoOrder": [2]`, `"covers": []`, `"layout": [{"textAbove":"Day two","photos":[2],"textBelow":""}]`} {
		if !strings.Contains(korea.Content, want) {
			t.Errorf("korea.json = %q, want %s", korea.Content, want)
		}
	}
	if _, ok := stagedContent(t, c, photosDir+"b.json"); ok {
		t.Error("b.json changed, want it kept in korea")
	}
}

func TestRemoveAlbumPhotosRefuses(t *testing.T) {
	_, c := albumTreeRepo(t)
	tests := []struct {
		name   string
		album  string
		ids    []int
		status int
	}{
		{"no photos", "korea", nil, http.StatusBadRequest},
		{"listed twice", "korea", []int{1, 1}, http.StatusBadRequest},
		{"no such photo", "korea", []int{9}, http.StatusNotFound},
		{"only in a sub-album", "korea", []int{3}, http.StatusConflict},
		{"no such album", "peru", []int{1}, http.StatusNotFound},
	}
	for _, tt := range tests {
		_, err := c.RemoveAlbumPhotos(t.Context(), baseURLSettings, tt.album, tt.ids)
		var perr *PublishError
		if !errors.As(err, &perr) || perr.Status != tt.status {
			t.Errorf("RemoveAlbumPhotos(%s) error = %v, want status %d", tt.name, err, tt.status)
		}
	}
}
