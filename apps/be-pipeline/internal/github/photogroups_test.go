package github

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

func TestWithGroups(t *testing.T) {
	content := "{\n  \"file\": \"a.jpg\",\n  \"albums\": [],\n  \"tags\": [\n    \"night\"\n  ],\n  \"images\": {}\n}\n"
	got, err := withGroups([]byte(content), []string{"seoul"}, []string{"night", "macro"})
	if err != nil {
		t.Fatalf("withGroups() error = %v", err)
	}
	want := "{\n  \"file\": \"a.jpg\",\n  \"albums\": [\n    \"seoul\"\n  ],\n  \"tags\": [\n    \"night\",\n    \"macro\"\n  ],\n  \"images\": {}\n}\n"
	if string(got) != want {
		t.Errorf("withGroups() =\n%s\nwant\n%s", got, want)
	}

	// An older file without the lists gets them at the end.
	got, err = withGroups([]byte(`{"file":"a.jpg"}`), nil, []string{"macro"})
	if err != nil || !json.Valid(got) || !strings.HasSuffix(string(got), "\"tags\": [\n    \"macro\"\n  ]}") {
		t.Errorf("withGroups() = %s, %v; want tags added", got, err)
	}

	// Nothing to add leaves it byte for byte.
	if got, _ := withGroups([]byte(content), nil, []string{"night"}); string(got) != content {
		t.Errorf("withGroups() = %s, want it unchanged", got)
	}
	if _, err := withGroups([]byte(`{"albums":"seoul"}`), []string{"a"}, nil); err == nil {
		t.Error("withGroups() error = nil, want one for albums that isn't a list")
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
	if got.Files != 2 || got.PullRequestNumber != 7 {
		t.Errorf("AddPhotoGroups() = %+v, want 2 files in the pull request", got)
	}
	for _, e := range repo.tree {
		var data struct{ Albums []string }
		if json.Unmarshal([]byte(e["content"]), &data) != nil || len(data.Albums) != 1 || data.Albums[0] != "seoul" {
			t.Errorf("%s = %s, want album seoul", e["path"], e["content"])
		}
	}
	if msg := repo.commit["message"]; msg != "Add albums and tags to 2 photos" {
		t.Errorf("commit message = %v", msg)
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
		{"nothing to add", PhotoGroups{Paths: []string{dir + "B.json"}}, "Choose albums or tags"},
		{"bad ID", PhotoGroups{Paths: []string{dir + "B.json"}, Tags: []string{"Not An ID"}}, "isn't an album or tag ID"},
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
			if repo.commit != nil {
				t.Errorf("committed %v, want nothing", repo.commit)
			}
		})
	}
}
