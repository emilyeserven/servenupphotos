package github

import (
	"encoding/json"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

func TestCombined(t *testing.T) {
	const root = dataRoot + "/"
	f, c := newFakeGitHub(t)
	f.files["main:"+root+"photos/ALLPHOTOS.json"] = `[{"file":"A.jpg"}]`
	f.files["main:"+root+"albums/ALLALBUMS.json"] = `{"not":"an array"}`
	f.openPull(prBranch, map[string]string{
		root + "photos/ALLPHOTOS.json": `[{"file":"A.jpg"},{"file":"B.jpg"}]`,
		root + "tags/ALLTAGS.json":     `[]`,
	})
	delete(f.files, prBranch+":"+root+"albums/ALLALBUMS.json")
	got, err := c.Combined(t.Context(), pullGH)
	if err != nil {
		t.Fatal(err)
	}
	if got.Repo != "owner/repo" || got.Folder != dataRoot || got.Base.Branch != "main" {
		t.Errorf("Combined() = %+v, want owner/repo's data folder on main", got)
	}

	base := got.Base
	if p := base.Photos; !p.Found || p.Count != 1 || string(p.Data) != `[{"file":"A.jpg"}]` ||
		p.FileURL != "https://github.com/owner/repo/blob/main/"+root+"photos/ALLPHOTOS.json" {
		t.Errorf("Base.Photos = %+v", p)
	}
	if a := base.Albums; !a.Found || a.Error != "The file isn't a JSON array." || a.Data != nil {
		t.Errorf("Base.Albums = %+v, want a JSON array error", a)
	}
	if tags := base.Tags; tags.Found || tags.FileURL != "" || tags.Path != root+"tags/ALLTAGS.json" {
		t.Errorf("Base.Tags = %+v, want not found", tags)
	}

	if got.Head == nil || got.Head.PullRequest.Number != 1 || got.Head.PullRequest.HeadSHA != f.head(prBranch) {
		t.Fatalf("Head = %+v, want pull request 1 at its head", got.Head)
	}
	if p := got.Head.Photos; p.Count != 2 ||
		p.FileURL != "https://github.com/owner/repo/blob/"+prBranch+"/"+root+"photos/ALLPHOTOS.json" {
		t.Errorf("Head.Photos = %+v, want two photos linked on the branch", p)
	}
	if tags := got.Head.Tags; !tags.Found || tags.Count != 0 || string(tags.Data) != `[]` {
		t.Errorf("Head.Tags = %+v, want an empty list", tags)
	}
	if a := got.Head.Albums; a.Found {
		t.Errorf("Head.Albums = %+v, want not found", a)
	}
	if n := len(f.calls); n != 3 {
		t.Errorf("Combined() made %d GitHub calls (%v), want 3: the state and two snapshots", n, f.calls)
	}
}

func TestCombinedNoPullRequest(t *testing.T) {
	_, c := newFakeGitHub(t)
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
