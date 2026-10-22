package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

var organizeGH = settings.GitHub{Repo: "owner/repo", Folder: "data", Token: token}

func TestCreateGroupOpensThenReusesPullRequest(t *testing.T) {
	f, c := newFakeRepo(t)

	got, err := c.CreateGroup(t.Context(), organizeGH, Albums, NewGroup{ID: "seoul", Name: " Seoul ", Description: "Spring 2026"})
	if err != nil {
		t.Fatalf("CreateGroup() error = %v", err)
	}
	if got.Path != "data/albums/seoul.json" || !got.NewPullRequest || got.PullRequestNumber != 1 {
		t.Errorf("CreateGroup() = %+v, want data/albums/seoul.json in a new pull request", got)
	}
	want := "{\n  \"id\": \"seoul\",\n  \"name\": \"Seoul\",\n  \"description\": \"Spring 2026\"\n}\n"
	if content := f.files["photo-data/2026-10-15-024500:data/albums/seoul.json"]; content != want {
		t.Errorf("file content = %q, want %q", content, want)
	}

	tag, err := c.CreateGroup(t.Context(), organizeGH, Tags, NewGroup{ID: "macro", Name: "Macro"})
	if err != nil {
		t.Fatalf("CreateGroup(tag) error = %v", err)
	}
	if tag.Path != "data/tags/macro.json" || tag.NewPullRequest || tag.PullRequestNumber != 1 {
		t.Errorf("CreateGroup(tag) = %+v, want data/tags/macro.json added to pull request 1", tag)
	}
}

func TestCreateGroupRefusesCollisions(t *testing.T) {
	f, c := newFakeRepo(t)
	f.files["main:data/albums/seoul.json"] = `{"id":"seoul","name":"Seoul"}`
	f.files["main:data/albums/ALLALBUMS.json"] = `[{"id":"all","name":"All"}]`
	f.files["main:data/tags/macro.json"] = `{"id":"macro","name":"Close Up"}`

	tests := []struct {
		name  string
		kind  Kind
		group NewGroup
		want  string
	}{
		{"same ID as an album", Tags, NewGroup{ID: "seoul", Name: "Seoul tag"}, `album "Seoul" already has the ID "seoul"`},
		{"same name as a tag, other case", Albums, NewGroup{ID: "close-up", Name: "close up"}, `already a tag named "Close Up"`},
		{"same ID as a tag", Albums, NewGroup{ID: "macro", Name: "Macro"}, `tag "Close Up" already has the ID "macro"`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := c.CreateGroup(t.Context(), organizeGH, tt.kind, tt.group)
			var perr *PublishError
			if !errors.As(err, &perr) || perr.Status != http.StatusConflict || !strings.Contains(perr.Message, tt.want) {
				t.Errorf("CreateGroup() error = %v, want a conflict containing %q", err, tt.want)
			}
		})
	}
	// ALLALBUMS.json isn't an album, so its entries don't collide.
	if _, err := c.CreateGroup(t.Context(), organizeGH, Albums, NewGroup{ID: "all", Name: "All"}); err != nil {
		t.Errorf("CreateGroup(all) error = %v, want it saved", err)
	}
	if f.writes != 1 {
		t.Errorf("wrote %d files, want only the album without a collision", f.writes)
	}
}

func TestCreateGroupChecksThePullRequest(t *testing.T) {
	f, c := newFakeRepo(t)
	if _, err := c.CreateGroup(t.Context(), organizeGH, Tags, NewGroup{ID: "night", Name: "Night"}); err != nil {
		t.Fatal(err)
	}
	_, err := c.CreateGroup(t.Context(), organizeGH, Albums, NewGroup{ID: "night-time", Name: "NIGHT"})
	var perr *PublishError
	if !errors.As(err, &perr) || perr.Status != http.StatusConflict {
		t.Errorf("CreateGroup() error = %v, want a conflict with the tag in flight", err)
	}
	if f.writes != 1 {
		t.Errorf("wrote %d files, want 1", f.writes)
	}
}

func TestCreateGroupValidates(t *testing.T) {
	_, c := newFakeRepo(t)
	tests := []struct {
		name  string
		group NewGroup
		want  string
	}{
		{"no name", NewGroup{ID: "a", Name: "  "}, "Give the album a name"},
		{"uppercase ID", NewGroup{ID: "Seoul", Name: "Seoul"}, "lowercase letters"},
		{"path in ID", NewGroup{ID: "../x", Name: "X"}, "lowercase letters"},
		{"double dash", NewGroup{ID: "a--b", Name: "X"}, "single dashes"},
		{"long name", NewGroup{ID: "a", Name: strings.Repeat("あ", 101)}, "100 characters"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := c.CreateGroup(t.Context(), organizeGH, Albums, tt.group)
			var perr *PublishError
			if !errors.As(err, &perr) || perr.Status != http.StatusBadRequest || !strings.Contains(perr.Message, tt.want) {
				t.Errorf("CreateGroup() error = %v, want a 400 containing %q", err, tt.want)
			}
		})
	}
}

func TestOrganize(t *testing.T) {
	f, c := newFakeRepo(t)
	f.files["main:data/albums/seoul.json"] = `{"id":"seoul","name":"Seoul","description":"Spring"}`
	f.files["main:data/albums/ALLALBUMS.json"] = `[]`
	f.files["main:data/albums/broken.json"] = `{nope`
	if _, err := c.CreateGroup(t.Context(), organizeGH, Albums, NewGroup{ID: "busan", Name: "Busan"}); err != nil {
		t.Fatal(err)
	}
	// The pull request's branch starts from main.
	for _, p := range []string{"data/albums/seoul.json", "data/albums/ALLALBUMS.json", "data/albums/broken.json"} {
		f.files["photo-data/2026-10-15-024500:"+p] = f.files["main:"+p]
	}

	got, err := c.Organize(t.Context(), organizeGH)
	if err != nil {
		t.Fatalf("Organize() error = %v", err)
	}
	if got.PullRequest == nil || got.PullRequest.Number != 1 || got.Folder != "data" || got.Branch != "main" {
		t.Errorf("Organize() = %+v, want pull request 1 in folder data", got)
	}
	if len(got.Tags) != 0 {
		t.Errorf("Tags = %+v, want none", got.Tags)
	}
	if len(got.Albums) != 3 {
		t.Fatalf("Albums = %+v, want broken, Busan and Seoul", got.Albums)
	}
	broken, busan, seoul := got.Albums[0], got.Albums[1], got.Albums[2]
	if broken.ID != "broken" || broken.Error == "" {
		t.Errorf("Albums[0] = %+v, want broken.json with an error", broken)
	}
	if busan.ID != "busan" || busan.Name != "Busan" || !busan.InFlight || busan.Path != "data/albums/busan.json" {
		t.Errorf("Albums[1] = %+v, want Busan in flight", busan)
	}
	if seoul.Name != "Seoul" || seoul.Description != "Spring" || seoul.InFlight {
		t.Errorf("Albums[2] = %+v, want Seoul on main", seoul)
	}
}

func TestInFlightAlbumsAndTags(t *testing.T) {
	const dir = "apps/portfolio/src/data/"
	c := newInFlightRepo(t, []map[string]any{photoPull},
		[]map[string]any{
			{"filename": dir + "albums/seoul.json", "status": "added", "blob_url": "https://github.com/blob/seoul"},
			{"filename": dir + "albums/ALLALBUMS.json", "status": "added", "blob_url": "https://github.com/blob/allalbums"},
			{"filename": dir + "tags/macro.json", "status": "added"},
			{"filename": dir + "tags/old.json", "status": "removed"},
		},
		map[string]string{
			dir + "albums/seoul.json":     `{"id":"seoul","name":"Seoul"}`,
			dir + "albums/ALLALBUMS.json": `[{"name":"Seoul","id":"seoul"}]`,
			dir + "tags/macro.json":       `{"id":"macro","name":"Macro"}`,
		})
	got, err := c.InFlight(t.Context(), settings.GitHub{Repo: "owner/repo", Token: token})
	if err != nil {
		t.Fatalf("InFlight() error = %v", err)
	}
	if len(got.Files) != 0 {
		t.Errorf("Files = %+v, want no photos", got.Files)
	}
	albums := got.Albums
	if albums.Folder != dir+"albums" || len(albums.Files) != 1 || albums.Files[0].FileURL != "https://github.com/blob/seoul" {
		t.Fatalf("Albums = %+v, want seoul.json", albums)
	}
	tags := got.Tags
	if len(tags.Files) != 1 || tags.Files[0].Path != dir+"tags/macro.json" {
		t.Errorf("Tags.Files = %+v, want macro.json", tags.Files)
	}
}
