package github

import (
	"encoding/json"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

func TestCombined(t *testing.T) {
	const root = "apps/portfolio/src/data/"
	gh := settings.GitHub{Repo: "owner/repo", Token: token}
	c := newAllPhotosRepo(t, []map[string]any{photoPull}, nil, map[string]string{
		root + "photos/ALLPHOTOS.json@main":  `[{"file":"A.jpg"}]`,
		root + "albums/ALLALBUMS.json@main":  `{"not":"an array"}`,
		root + "photos/ALLPHOTOS.json@head7": `[{"file":"A.jpg"},{"file":"B.jpg"}]`,
		root + "tags/ALLTAGS.json@head7":     `[]`,
	})
	got, err := c.Combined(t.Context(), gh)
	if err != nil {
		t.Fatal(err)
	}
	if got.Repo != "owner/repo" || got.Folder != "apps/portfolio/src/data" || got.Base.Branch != "main" {
		t.Errorf("Combined() = %+v, want owner/repo's data folder on main", got)
	}

	base := got.Base
	if p := base.Photos; !p.Found || p.Count != 1 || string(p.Data) != `[{"file":"A.jpg"}]` ||
		p.FileURL != "https://github.com/owner/repo/blob/main/apps/portfolio/src/data/photos/ALLPHOTOS.json" {
		t.Errorf("Base.Photos = %+v", p)
	}
	if a := base.Albums; !a.Found || a.Error != "The file isn't a JSON array." || a.Data != nil {
		t.Errorf("Base.Albums = %+v, want a JSON array error", a)
	}
	if tags := base.Tags; tags.Found || tags.FileURL != "" || tags.Path != root+"tags/ALLTAGS.json" {
		t.Errorf("Base.Tags = %+v, want not found", tags)
	}

	if got.Head == nil || got.Head.PullRequest.Number != 7 || got.Head.PullRequest.HeadSHA != "head7" {
		t.Fatalf("Head = %+v, want pull request 7 at head7", got.Head)
	}
	if p := got.Head.Photos; p.Count != 2 ||
		p.FileURL != "https://github.com/owner/repo/blob/photo-data/2026-10-15-024500/apps/portfolio/src/data/photos/ALLPHOTOS.json" {
		t.Errorf("Head.Photos = %+v, want two photos linked on the branch", p)
	}
	if tags := got.Head.Tags; !tags.Found || tags.Count != 0 || string(tags.Data) != `[]` {
		t.Errorf("Head.Tags = %+v, want an empty list", tags)
	}
	if a := got.Head.Albums; a.Found {
		t.Errorf("Head.Albums = %+v, want not found", a)
	}
}

func TestCombinedNoPullRequest(t *testing.T) {
	c := newAllPhotosRepo(t, []map[string]any{}, nil, nil)
	got, err := c.Combined(t.Context(), settings.GitHub{Repo: "owner/repo", Folder: "/data/", Token: token})
	if err != nil {
		t.Fatal(err)
	}
	if got.Head != nil || got.Base.Photos.Found || got.Base.Photos.Path != "data/photos/ALLPHOTOS.json" {
		t.Errorf("Combined() = %+v, want no head and nothing found in data/", got)
	}
	// Head is sent as null, so pages can tell no pull request from an empty one.
	if b, _ := json.Marshal(got); !json.Valid(b) || !containsNullHead(b) {
		t.Errorf("JSON = %s, want \"head\":null", b)
	}
}

func containsNullHead(b []byte) bool {
	var v map[string]json.RawMessage
	return json.Unmarshal(b, &v) == nil && string(v["head"]) == "null"
}
