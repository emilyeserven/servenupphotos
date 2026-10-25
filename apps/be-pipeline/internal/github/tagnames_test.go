package github

import "testing"

func TestNormalizeTagNames(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.files["main:data/tags/street-food.json"] = `{"id":"street-food","name":"Street Food","description":"Stalls"}`
	f.files["main:data/tags/night.json"] = `{"id":"night","name":"night","description":""}`
	f.files["main:data/tags/broken.json"] = `{nope`
	f.files["main:data/albums/seoul.json"] = `{"id":"seoul","name":"Seoul"}`

	got, err := c.NormalizeTagNames(t.Context(), organizeGH)
	if err != nil {
		t.Fatalf("NormalizeTagNames() error = %v", err)
	}
	if got.Files != 1 {
		t.Errorf("Files = %d, want only Street Food renamed", got.Files)
	}
	want := `{"id":"street-food","name":"street-food","description":"Stalls"}`
	if content, _ := stagedContent(t, c, "data/tags/street-food.json"); content.Content != want {
		t.Errorf("street-food.json = %q, want %q", content.Content, want)
	}
	if n := pendingCount(t, c); n != 1 {
		t.Errorf("%d files pending, want 1: the album, night and broken.json stay as they are", n)
	}

	again, err := c.NormalizeTagNames(t.Context(), organizeGH)
	if err != nil || again.Files != 0 {
		t.Errorf("NormalizeTagNames() again = %+v, %v, want nothing to change", again, err)
	}
}
