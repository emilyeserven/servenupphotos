package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"
)

// deletePhotoRepo starts a fake repo whose photo data pull request has photo
// 1 (a.json, with an unedited original), photos 2 and 3, and files that point
// at photo 1: an album, photo 3's Unselected Photos winners, the bio, viewer
// likes, a photo book and a trip line.
func deletePhotoRepo(t *testing.T) (*fakeGitHub, *Client) {
	t.Helper()
	f, c := newFakeGitHub(t)
	f.openPull(prBranch, map[string]string{
		photosDir + "ALLPHOTOS.json": "[]\n",
		photosDir + "a.json": "{\n  \"id\": 1,\n  \"file\": \"a.jpg\",\n  \"images\": { \"key\": \"photos/x-a.jpg\" },\n" +
			"  \"original\": { \"images\": { \"key\": \"photos/x-a-original.jpg\" } }\n}\n",
		photosDir + "b.json": "{\n  \"id\": 2\n}\n",
		photosDir + "c.json": "{\n  \"id\": 3,\n  \"unselected\": { \"reason\": \"soft\", \"winners\": [1, 2], \"group\": \"g\" }\n}\n",
		dataRoot + "/albums/korea.json": "{\n  \"id\": \"korea\",\n  \"name\": \"Korea\",\n  \"parent\": null,\n" +
			"  \"photoOrder\": [2, 1],\n  \"covers\": [1],\n  \"layout\": [{\"textAbove\":\"\",\"photos\":[1],\"textBelow\":\"\"}]\n}\n",
		dataRoot + "/bio/bio.json":   "{\n  \"id\": \"bio\",\n  \"text\": \"\",\n  \"photos\": [{ \"photo\": \"" + photosDir + "a.json\" }, { \"photo\": \"" + photosDir + "b.json\" }]\n}\n",
		dataRoot + "/likes/sam.json": "{\n  \"id\": \"sam\",\n  \"name\": \"Sam\",\n  \"photos\": [1, 2],\n  \"importedAt\": \"\"\n}\n",
		dataRoot + "/photobooks/2026.json": "{\n  \"id\": \"2026\",\n  \"name\": \"2026\",\n  \"template\": \"\",\n" +
			"  \"pages\": [{ \"id\": \"p1\", \"layout\": \"one\", \"title\": null, \"slots\": [{ \"photo\": \"" + photosDir + "a.json\", \"caption\": \"Hi\" }] }]\n}\n",
		dataRoot + "/triplines/2025-01-19.json": "{\n  \"id\": \"2025-01-19\",\n  \"day\": \"2025-01-19\",\n  \"auto\": false,\n" +
			"  \"segments\": [{ \"mode\": \"walk\", \"photos\": [2, 1, 3], \"via\": [{ \"after\": 1, \"latitude\": 1, \"longitude\": 2 }] }," +
			" { \"mode\": \"walk\", \"photos\": [1] }],\n" +
			"  \"visits\": [{ \"name\": \"Lunch\", \"kind\": \"food\", \"latitude\": 1, \"longitude\": 2, \"after\": 1, \"photos\": [1] }],\n" +
			"  \"fences\": [{ \"name\": \"Park\", \"photos\": [1], \"shape\": [] }],\n  \"order\": [2, 1, 3]\n}\n",
	})
	return f, c
}

func TestDeletePhoto(t *testing.T) {
	f, c := deletePhotoRepo(t)
	got, err := c.DeletePhoto(t.Context(), baseURLSettings, photosDir+"a.json")
	if err != nil {
		t.Fatalf("DeletePhoto() error = %v", err)
	}
	if got.ImageKey != "photos/x-a.jpg" || got.OriginalKey != "photos/x-a-original.jpg" || got.PhotoName != "a.jpg" {
		t.Errorf("DeletePhoto() = %+v, want its image and original keys", got)
	}
	if len(got.Changes) != 7 {
		t.Errorf("DeletePhoto() changed %d files, want 7: %+v", len(got.Changes), got.Changes)
	}
	if w := f.writes(); len(w) != 0 {
		t.Errorf("DeletePhoto() wrote to GitHub: %v", w)
	}
	if a, ok := stagedContent(t, c, photosDir+"a.json"); !ok || !a.Deleted {
		t.Errorf("a.json = %+v, want deleted", a)
	}
	if _, ok := stagedContent(t, c, photosDir+"b.json"); ok {
		t.Error("b.json changed, want it left as it was")
	}
	want := map[string][]string{
		photosDir + "c.json":                    {`"winners": [2]`, `"reason": "soft"`},
		dataRoot + "/albums/korea.json":         {`"photoOrder": [2]`, `"covers": []`, `"layout": []`},
		dataRoot + "/bio/bio.json":              {photosDir + "b.json"},
		dataRoot + "/likes/sam.json":            {`"photos": [2]`},
		dataRoot + "/photobooks/2026.json":      {`"photo": ""`, `"caption": null`},
		dataRoot + "/triplines/2025-01-19.json": {`"photos": [2, 3]`, `"after": 2`, `"order": [2, 3]`},
	}
	for path, parts := range want {
		got, _ := stagedContent(t, c, path)
		for _, part := range parts {
			if !strings.Contains(got.Content, part) {
				t.Errorf("%s = %q, want it to have %s", path, got.Content, part)
			}
		}
	}
	line, _ := stagedContent(t, c, dataRoot+"/triplines/2025-01-19.json")
	for _, gone := range []string{"Park", `"photos": [1]`, `"photos": []`} {
		if strings.Contains(line.Content, gone) {
			t.Errorf("trip line = %q, want no %s", line.Content, gone)
		}
	}
	if bio, _ := stagedContent(t, c, dataRoot+"/bio/bio.json"); strings.Contains(bio.Content, "a.json") {
		t.Errorf("bio = %q, want a.json off it", bio.Content)
	}

	_, err = c.DeletePhoto(t.Context(), baseURLSettings, photosDir+"a.json")
	var perr *PublishError
	if !errors.As(err, &perr) || perr.Status != http.StatusNotFound {
		t.Errorf("DeletePhoto(again) error = %v, want not found", err)
	}
}

func TestDeletePhotoOnlyPhotoFiles(t *testing.T) {
	_, c := deletePhotoRepo(t)
	_, err := c.DeletePhoto(t.Context(), baseURLSettings, dataRoot+"/albums/korea.json")
	var perr *PublishError
	if !errors.As(err, &perr) || perr.Status != http.StatusBadRequest {
		t.Errorf("DeletePhoto(album) error = %v, want a bad request", err)
	}
}

func TestTripLineWithoutFirstPhoto(t *testing.T) {
	after := 1
	line := TripLine{
		Segments: []TripSegment{{Mode: ModeWalk, Photos: []int{1, 2, 3}}},
		Visits:   []TripVisit{{Name: "Breakfast", After: &after}},
	}
	if !tripLineWithout(&line, 1) {
		t.Fatal("tripLineWithout() = false, want a change")
	}
	if v := line.Visits[0]; v.After != nil || !v.First {
		t.Errorf("visit = %+v, want it first in the day", v)
	}
	if got := line.Segments[0].Photos; len(got) != 2 || got[0] != 2 {
		t.Errorf("photos = %v, want [2 3]", got)
	}
}
