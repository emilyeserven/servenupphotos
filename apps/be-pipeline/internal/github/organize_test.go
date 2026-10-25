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
	f, c := newFakeGitHub(t)

	got, err := c.CreateGroup(t.Context(), organizeGH, Albums, NewGroup{ID: "seoul", Name: " Seoul ", Description: "Spring 2026"})
	if err != nil {
		t.Fatalf("CreateGroup() error = %v", err)
	}
	if got.Path != "data/albums/seoul.json" || got.PullRequestNumber != 0 {
		t.Errorf("CreateGroup() = %+v, want data/albums/seoul.json pending, with no pull request yet", got)
	}
	want := "{\n  \"id\": \"seoul\",\n  \"name\": \"Seoul\",\n  \"description\": \"Spring 2026\",\n  \"parent\": null\n}\n"
	if content, _ := stagedContent(t, c, "data/albums/seoul.json"); content.Content != want {
		t.Errorf("file content = %q, want %q", content.Content, want)
	}

	tag, err := c.CreateGroup(t.Context(), organizeGH, Tags, NewGroup{ID: "macro", Name: "macro"})
	if err != nil {
		t.Fatalf("CreateGroup(tag) error = %v", err)
	}
	if tag.Path != "data/tags/macro.json" {
		t.Errorf("CreateGroup(tag) = %+v, want data/tags/macro.json", tag)
	}
	if w := f.writes(); len(w) != 0 {
		t.Errorf("CreateGroup() wrote to GitHub: %v", w)
	}
	// Tags have no parent.
	if content, _ := stagedContent(t, c, "data/tags/macro.json"); strings.Contains(content.Content, "parent") {
		t.Errorf("tag content = %q, want no parent", content.Content)
	}

	genre, err := c.CreateGroup(t.Context(), organizeGH, Genres, NewGroup{ID: "street", Name: "Street"})
	if err != nil || genre.Path != "data/genres/street.json" {
		t.Errorf("CreateGroup(genre) = %+v, %v; want data/genres/street.json", genre, err)
	}
	wantGenre := "{\n  \"id\": \"street\",\n  \"name\": \"Street\",\n  \"description\": \"\"\n}\n"
	if content, _ := stagedContent(t, c, "data/genres/street.json"); content.Content != wantGenre {
		t.Errorf("genre content = %q, want %q", content.Content, wantGenre)
	}
}

func TestCreateGroupWithParent(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.files["main:data/albums/korea.json"] = `{"id":"korea","name":"Korea","parent":null}`

	if _, err := c.CreateGroup(t.Context(), organizeGH, Albums, NewGroup{ID: "seoul", Name: "Seoul", Parent: "korea"}); err != nil {
		t.Fatalf("CreateGroup() error = %v", err)
	}
	if content, _ := stagedContent(t, c, "data/albums/seoul.json"); !strings.Contains(content.Content, `"parent": "korea"`) {
		t.Errorf("file content = %q, want parent korea", content.Content)
	}
	got, err := c.Organize(t.Context(), organizeGH)
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Albums) != 2 || got.Albums[1].ID != "seoul" || got.Albums[1].Parent != "korea" || got.Albums[0].Parent != "" {
		t.Errorf("Albums = %+v, want Seoul inside Korea", got.Albums)
	}

	for _, tt := range []struct {
		kind   Kind
		group  NewGroup
		status int
	}{
		{Albums, NewGroup{ID: "busan", Name: "Busan", Parent: "japan"}, http.StatusBadRequest},
		{Tags, NewGroup{ID: "night", Name: "night", Parent: "korea"}, http.StatusBadRequest},
	} {
		_, err := c.CreateGroup(t.Context(), organizeGH, tt.kind, tt.group)
		var perr *PublishError
		if !errors.As(err, &perr) || perr.Status != tt.status {
			t.Errorf("CreateGroup(%+v) error = %v, want status %d", tt.group, err, tt.status)
		}
	}
}

func TestCheckParent(t *testing.T) {
	albums := []Group{{ID: "asia", Name: "Asia"}, {ID: "korea", Name: "Korea", Parent: "asia"}, {ID: "seoul", Name: "Seoul", Parent: "korea"}}
	tests := []struct {
		id, parent, want string
	}{
		{"seoul", "asia", ""},
		{"asia", "seoul", `"Seoul" is inside "Asia" already`},
		{"asia", "asia", `"Asia" is inside "Asia" already`},
		{"seoul", "japan", `no album with the ID "japan"`},
	}
	for _, tt := range tests {
		perr := checkParent(albums, tt.id, tt.parent)
		if tt.want == "" && perr != nil || tt.want != "" && (perr == nil || !strings.Contains(perr.Message, tt.want)) {
			t.Errorf("checkParent(%s, %s) = %v, want %q", tt.id, tt.parent, perr, tt.want)
		}
	}
}

func TestCreateGroupRefusesCollisions(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.files["main:data/albums/seoul.json"] = `{"id":"seoul","name":"Seoul"}`
	f.files["main:data/albums/ALLALBUMS.json"] = `[{"id":"all","name":"All"}]`
	f.files["main:data/tags/macro.json"] = `{"id":"macro","name":"Close Up"}`

	tests := []struct {
		name  string
		kind  Kind
		group NewGroup
		want  string
	}{
		{"same ID as an album", Tags, NewGroup{ID: "seoul", Name: "seoul"}, `album "Seoul" already has the ID "seoul"`},
		{"same name as a tag, other case", Albums, NewGroup{ID: "close-up", Name: "close up"}, `already a tag named "Close Up"`},
		{"same ID as a tag", Albums, NewGroup{ID: "macro", Name: "Macro"}, `tag "Close Up" already has the ID "macro"`},
		{"genre with a tag's name", Genres, NewGroup{ID: "closeup", Name: "Close up"}, `already a tag named "Close Up"`},
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
	if n := pendingCount(t, c); n != 1 {
		t.Errorf("%d files pending, want only the album without a collision", n)
	}
}

func TestCreateGroupChecksThePullRequest(t *testing.T) {
	_, c := newFakeGitHub(t)
	if _, err := c.CreateGroup(t.Context(), organizeGH, Tags, NewGroup{ID: "night", Name: "night"}); err != nil {
		t.Fatal(err)
	}
	_, err := c.CreateGroup(t.Context(), organizeGH, Albums, NewGroup{ID: "night-time", Name: "NIGHT"})
	var perr *PublishError
	if !errors.As(err, &perr) || perr.Status != http.StatusConflict {
		t.Errorf("CreateGroup() error = %v, want a conflict with the tag in flight", err)
	}
	if n := pendingCount(t, c); n != 1 {
		t.Errorf("%d files pending, want 1", n)
	}
}

func TestCreateGroupValidates(t *testing.T) {
	_, c := newFakeGitHub(t)
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

func TestCreateTagNeedsAKebabCaseName(t *testing.T) {
	_, c := newFakeGitHub(t)
	for _, name := range []string{"Street Food", "street food", "Street-Food", "streetfood"} {
		t.Run(name, func(t *testing.T) {
			_, err := c.CreateGroup(t.Context(), organizeGH, Tags, NewGroup{ID: "street-food", Name: name})
			var perr *PublishError
			if !errors.As(err, &perr) || perr.Status != http.StatusBadRequest || !strings.Contains(perr.Message, "kebab-case") {
				t.Errorf("CreateGroup(%q) error = %v, want a 400 asking for kebab-case", name, err)
			}
		})
	}
	if _, err := c.CreateGroup(t.Context(), organizeGH, Tags, NewGroup{ID: "street-food", Name: "street-food"}); err != nil {
		t.Errorf("CreateGroup(street-food) error = %v, want it saved", err)
	}
}

func TestOrganize(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.files["main:data/albums/seoul.json"] = `{"id":"seoul","name":"Seoul","description":"Spring"}`
	f.files["main:data/albums/ALLALBUMS.json"] = `[]`
	f.files["main:data/albums/broken.json"] = `{nope`
	f.openPull(prBranch, nil)
	if _, err := c.CreateGroup(t.Context(), organizeGH, Albums, NewGroup{ID: "busan", Name: "Busan"}); err != nil {
		t.Fatal(err)
	}

	got, err := c.Organize(t.Context(), organizeGH)
	if err != nil {
		t.Fatalf("Organize() error = %v", err)
	}
	if got.PullRequest == nil || got.PullRequest.Number != 1 || got.Folder != "data" || got.Branch != "main" {
		t.Errorf("Organize() = %+v, want pull request 1 in folder data", got)
	}
	if len(got.Tags) != 0 || len(got.Genres) != 0 {
		t.Errorf("Tags = %+v, Genres = %+v, want none", got.Tags, got.Genres)
	}
	if len(got.Albums) != 3 {
		t.Fatalf("Albums = %+v, want broken, Busan and Seoul", got.Albums)
	}
	broken, busan, seoul := got.Albums[0], got.Albums[1], got.Albums[2]
	if broken.ID != "broken" || broken.Error == "" {
		t.Errorf("Albums[0] = %+v, want broken.json with an error", broken)
	}
	if busan.ID != "busan" || busan.Name != "Busan" || !busan.InFlight || busan.Path != "data/albums/busan.json" || busan.FileURL != "" {
		t.Errorf("Albums[1] = %+v, want Busan in flight", busan)
	}
	if seoul.Name != "Seoul" || seoul.Description != "Spring" || seoul.InFlight {
		t.Errorf("Albums[2] = %+v, want Seoul on main", seoul)
	}
}

func TestSetAlbumParent(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.files["main:data/albums/korea.json"] = "{\n  \"id\": \"korea\",\n  \"name\": \"Korea\",\n  \"parent\": null\n}\n"
	f.files["main:data/albums/seoul.json"] = "{\n  \"id\": \"seoul\",\n  \"name\": \"Seoul\",\n  \"parent\": null\n}\n"
	got, err := c.SetAlbumParent(t.Context(), organizeGH, "seoul", "korea")
	if err != nil {
		t.Fatalf("SetAlbumParent() error = %v", err)
	}
	if !got.Changed || len(got.Changes) != 1 || !strings.Contains(string(got.Changes[0].After), `"parent": "korea"`) {
		t.Errorf("SetAlbumParent() = %+v, want seoul.json moved into korea", got)
	}
	again, err := c.SetAlbumParent(t.Context(), organizeGH, "seoul", "korea")
	if err != nil || again.Changed {
		t.Errorf("SetAlbumParent() again = %+v, %v; want nothing changed", again, err)
	}
	_, err = c.SetAlbumParent(t.Context(), organizeGH, "korea", "seoul")
	var perr *PublishError
	if !errors.As(err, &perr) || perr.Status != http.StatusConflict {
		t.Errorf("SetAlbumParent() into its own child: error = %v, want a conflict", err)
	}
	if w := f.writes(); len(w) != 0 {
		t.Errorf("SetAlbumParent() wrote to GitHub: %v", w)
	}
}

// pendingCount is how many files have pending changes.
func pendingCount(t *testing.T, c *Client) int {
	t.Helper()
	files, err := c.stage().files(target{owner: "owner", name: "repo"})
	if err != nil {
		t.Fatal(err)
	}
	return len(files)
}

func TestInFlightAlbumsAndTags(t *testing.T) {
	const dir = "apps/portfolio/src/data/"
	f, c := newFakeGitHub(t)
	f.files["main:"+dir+"tags/old.json"] = `{"id":"old","name":"Old"}`
	f.openPull(prBranch, map[string]string{
		dir + "albums/seoul.json":     `{"id":"seoul","name":"Seoul"}`,
		dir + "albums/ALLALBUMS.json": `[{"name":"Seoul","id":"seoul"}]`,
		dir + "tags/macro.json":       `{"id":"macro","name":"Macro"}`,
	})
	delete(f.files, prBranch+":"+dir+"tags/old.json")
	got, err := c.InFlight(t.Context(), settings.GitHub{Repo: "owner/repo", Token: token})
	if err != nil {
		t.Fatalf("InFlight() error = %v", err)
	}
	if len(got.Files) != 0 {
		t.Errorf("Files = %+v, want no photos", got.Files)
	}
	albums := got.Albums
	if albums.Folder != dir+"albums" || len(albums.Files) != 1 || albums.Files[0].FileURL != "https://github.com/owner/repo/blob/"+prBranch+"/"+dir+"albums/seoul.json" {
		t.Fatalf("Albums = %+v, want seoul.json", albums)
	}
	tags := got.Tags
	if len(tags.Files) != 1 || tags.Files[0].Path != dir+"tags/macro.json" {
		t.Errorf("Tags.Files = %+v, want macro.json", tags.Files)
	}
}
