package github

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

func TestWithGroups(t *testing.T) {
	content := "{\n  \"file\": \"a.jpg\",\n  \"albums\": [],\n  \"tags\": [\n    \"night\"\n  ],\n  \"images\": {}\n}\n"
	got, err := withGroups([]byte(content), PhotoGroups{Albums: []string{"seoul"}, Tags: []string{"night", "macro"}})
	if err != nil {
		t.Fatalf("withGroups() error = %v", err)
	}
	want := "{\n  \"file\": \"a.jpg\",\n  \"albums\": [\n    \"seoul\"\n  ],\n  \"tags\": [\n    \"night\",\n    \"macro\"\n  ],\n  \"images\": {}\n}\n"
	if string(got) != want {
		t.Errorf("withGroups() =\n%s\nwant\n%s", got, want)
	}

	// An older file without the lists gets them at the end.
	got, err = withGroups([]byte(`{"file":"a.jpg"}`), PhotoGroups{Tags: []string{"macro"}})
	if err != nil || !json.Valid(got) || !strings.HasSuffix(string(got), "\"tags\": [\n    \"macro\"\n  ]}") {
		t.Errorf("withGroups() = %s, %v; want tags added", got, err)
	}

	// Nothing to add leaves it byte for byte.
	if got, _ := withGroups([]byte(content), PhotoGroups{Tags: []string{"night"}}); string(got) != content {
		t.Errorf("withGroups() = %s, want it unchanged", got)
	}
	if _, err := withGroups([]byte(`{"albums":"seoul"}`), PhotoGroups{Albums: []string{"a"}}); err == nil {
		t.Error("withGroups() error = nil, want one for albums that isn't a list")
	}

	// Genres go in their own list, after the ones the photo already has.
	got, err = withGroups([]byte(`{"genres":["street"]}`), PhotoGroups{Genres: []string{"street", "architecture"}})
	if err != nil || !strings.Contains(string(got), "\"street\",\n    \"architecture\"") {
		t.Errorf("withGroups() = %s, %v; want architecture added to genres", got, err)
	}
}

func TestAddPhotoGroups(t *testing.T) {
	const dir = "apps/portfolio/src/data/photos/"
	repo := &baseURLRepo{pull: true, files: map[string]string{"B.json": photoB, "C.json": photoC}}
	got, err := repo.start(t).AddPhotoGroups(t.Context(), baseURLSettings, PhotoGroups{
		Paths: []string{dir + "B.json", dir + "C.json"}, Albums: []string{"seoul"},
	})
	if err != nil {
		t.Fatalf("AddPhotoGroups() error = %v", err)
	}
	if got.Files != 2 || got.PullRequestNumber != 1 || len(got.Changes) != 2 {
		t.Errorf("AddPhotoGroups() = %+v, want 2 files pending for the pull request", got)
	}
	staged := repo.staged(t)
	if len(staged) != 2 {
		t.Errorf("pending = %v, want B.json and C.json", staged)
	}
	for p, content := range staged {
		var data struct{ Albums []string }
		if json.Unmarshal([]byte(content), &data) != nil || len(data.Albums) != 1 || data.Albums[0] != "seoul" {
			t.Errorf("%s = %s, want album seoul", p, content)
		}
	}
}

func TestAddPhotoGroupsErrors(t *testing.T) {
	const dir = "apps/portfolio/src/data/photos/"
	tests := []struct {
		name string
		add  PhotoGroups
		want string
	}{
		{"no photos", PhotoGroups{Albums: []string{"seoul"}}, "Choose the photos"},
		{"nothing to add", PhotoGroups{Paths: []string{dir + "B.json"}}, "Choose albums, tags or genres"},
		{"bad ID", PhotoGroups{Paths: []string{dir + "B.json"}, Tags: []string{"Not An ID"}}, "isn't an album, tag or genre ID"},
		{"listed twice", PhotoGroups{Paths: []string{dir + "B.json", dir + "B.json"}, Tags: []string{"a"}}, "more than once"},
		{"not a photo file", PhotoGroups{Paths: []string{dir + "D.json"}, Tags: []string{"a"}}, "D.json isn't a photo file"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &baseURLRepo{pull: true, files: map[string]string{"B.json": photoB}}
			_, err := repo.start(t).AddPhotoGroups(t.Context(), baseURLSettings, tt.add)
			var perr *PublishError
			if !errors.As(err, &perr) || !strings.Contains(perr.Message, tt.want) {
				t.Errorf("AddPhotoGroups() error = %v, want one containing %q", err, tt.want)
			}
			if staged := repo.staged(t); len(staged) != 0 {
				t.Errorf("pending = %v, want nothing", staged)
			}
		})
	}
}
