package github

import (
	"errors"
	"net/http"
	"testing"
)

func TestSetTagDescriptions(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.files["main:data/tags/shotengai.json"] = `{"id":"shotengai","name":"shotengai","description":""}`
	f.files["main:data/tags/night.json"] = `{"id":"night","name":"night","description":"after dark"}`
	f.files["main:data/tags/hanok.json"] = `{"id":"hanok","name":"hanok"}`

	got, err := c.SetTagDescriptions(t.Context(), organizeGH, map[string]string{
		"shotengai": "  a Japanese shopping street & arcade ",
		"night":     "after dark",
		"hanok":     "a traditional Korean house",
	})
	if err != nil {
		t.Fatalf("SetTagDescriptions() error = %v", err)
	}
	if got.Files != 2 {
		t.Errorf("Files = %d, want 2: night already has its description", got.Files)
	}
	want := `{"id":"shotengai","name":"shotengai","description":"a Japanese shopping street & arcade"}`
	if content, _ := stagedContent(t, c, "data/tags/shotengai.json"); content.Content != want {
		t.Errorf("shotengai.json = %q, want %q", content.Content, want)
	}
	want = "{\"id\":\"hanok\",\"name\":\"hanok\",\n  \"description\": \"a traditional Korean house\"}"
	if content, _ := stagedContent(t, c, "data/tags/hanok.json"); content.Content != want {
		t.Errorf("hanok.json = %q, want %q", content.Content, want)
	}
}

func TestSetTagDescriptionsRefuses(t *testing.T) {
	tests := map[string]struct {
		descriptions map[string]string
		status       int
	}{
		"not a tag":   {map[string]string{"seoul": "a city"}, http.StatusNotFound},
		"empty":       {map[string]string{"night": "  "}, http.StatusBadRequest},
		"unreadable":  {map[string]string{"broken": "anything"}, http.StatusConflict},
		"one of many": {map[string]string{"night": "after dark", "nope": "x"}, http.StatusNotFound},
	}
	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			f, c := newFakeGitHub(t)
			f.files["main:data/tags/night.json"] = `{"id":"night","name":"night","description":""}`
			f.files["main:data/tags/broken.json"] = `{nope`
			f.files["main:data/albums/seoul.json"] = `{"id":"seoul","name":"Seoul"}`
			_, err := c.SetTagDescriptions(t.Context(), organizeGH, tt.descriptions)
			var perr *PublishError
			if !errors.As(err, &perr) || perr.Status != tt.status {
				t.Fatalf("SetTagDescriptions() error = %v, want status %d", err, tt.status)
			}
			if n := pendingCount(t, c); n != 0 {
				t.Errorf("%d files pending, want nothing saved", n)
			}
		})
	}
}
