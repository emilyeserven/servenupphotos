package github

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"
)

const photosDir = dataRoot + "/photos/"

// stagedContent is path's pending content, and whether it has a pending change.
func stagedContent(t *testing.T, c *Client, path string) (StagedFile, bool) {
	t.Helper()
	files, err := c.stage().files(target{owner: "owner", name: "repo"})
	if err != nil {
		t.Fatal(err)
	}
	f, ok := files[path]
	return f, ok
}

func TestUpdate(t *testing.T) {
	const file = photosDir + "DSC0001.json"
	f, c := newFakeGitHub(t)
	f.openPull(prBranch, map[string]string{file: "{\n  \"file\": \"DSC0001.jpg\"\n}\n"})
	data := json.RawMessage(`{"file":"DSC0001.jpg","images":{"thumbnail":"https://pub/t.webp?crop=1,2,3"}}`)
	got, err := c.Update(t.Context(), pullGH, file, "", data)
	if err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	wantContent := "{\n  \"file\": \"DSC0001.jpg\",\n  \"images\": {\n    \"thumbnail\": \"https://pub/t.webp?crop=1,2,3\"\n  }\n}\n"
	if !got.Changed || got.Path != file || string(got.Data) != wantContent || string(got.Before) != "{\n  \"file\": \"DSC0001.jpg\"\n}\n" {
		t.Errorf("Update() = %+v, want it changed with its data before and after", got)
	}
	if got.PullRequestURL != "https://github.com/owner/repo/pull/1" {
		t.Errorf("PullRequestURL = %q, want the open pull request", got.PullRequestURL)
	}
	if staged, ok := stagedContent(t, c, file); !ok || staged.Content != wantContent {
		t.Errorf("pending %q, want %q", staged.Content, wantContent)
	}
	if w := f.writes(); len(w) != 0 {
		t.Errorf("Update() wrote to GitHub: %v", w)
	}

	// Saving it back as it was drops the pending change.
	if _, err := c.Update(t.Context(), pullGH, file, "", json.RawMessage(`{"file":"DSC0001.jpg"}`)); err != nil {
		t.Fatalf("Update() back error = %v", err)
	}
	if _, ok := stagedContent(t, c, file); ok {
		t.Error("the file is still pending after saving it back as it was")
	}
}

func TestUpdateUnchanged(t *testing.T) {
	const file = photosDir + "DSC0001.json"
	f, c := newFakeGitHub(t)
	f.openPull(prBranch, map[string]string{file: "{\n  \"file\": \"DSC0001.jpg\"\n}\n"})
	got, err := c.Update(t.Context(), pullGH, file, "", json.RawMessage(`{"file": "DSC0001.jpg"}`))
	if err != nil || got.Changed {
		t.Errorf("Update() = %+v, %v; want nothing changed", got, err)
	}
	if _, ok := stagedContent(t, c, file); ok {
		t.Error("an unchanged file is pending")
	}
}

func TestUpdatePublishedPhoto(t *testing.T) {
	const file = photosDir + "a.json"
	f, c := newFakeGitHub(t)
	f.files["main:"+file] = "{\"file\": \"A.jpg\"}\n"
	got, err := c.Update(t.Context(), pullGH, file, "", json.RawMessage(`{"file":"A.jpg","title":"Pond"}`))
	if err != nil || !got.Changed || got.PullRequestURL != "" {
		t.Fatalf("Update() = %+v, %v; want it pending with no pull request yet", got, err)
	}
	commit, err := c.CommitCombined(t.Context(), pullGH, nil)
	if err != nil || !commit.NewPullRequest {
		t.Fatalf("CommitCombined() = %+v, %v; want a new pull request", commit, err)
	}
	if main, _ := f.file("main", file); main != "{\"file\": \"A.jpg\"}\n" {
		t.Errorf("main changed to %q", main)
	}
	if branch, _ := f.file(prBranch, file); !strings.Contains(branch, "Pond") {
		t.Errorf("the pull request's copy = %q, want the edit", branch)
	}
}

func TestUpdateErrors(t *testing.T) {
	const file = photosDir + "DSC0001.json"
	tests := []struct {
		name   string
		file   string
		rename string
		data   string
		onMain bool
		want   string
	}{
		{"outside the folder", "README.json", "", `{}`, false, "Only photo JSON files"},
		{"ALLPHOTOS.json", photosDir + "ALLPHOTOS.json", "", `{}`, false, "Only photo JSON files"},
		{"not an object", file, "", `[1]`, false, "must be a JSON object"},
		{"null", file, "", `null`, false, "must be a JSON object"},
		{"not in the pull request", photosDir + "other.json", "", `{}`, false, "isn't in the photo data pull request or on main"},
		{"removed", photosDir + "gone.json", "", `{}`, false, "can't be edited"},
		{"bad new name", file, "night market", `{}`, false, "Use a file name"},
		{"rename a published file", file, "Night-market", `{}`, true, "keeps its name"},
		{"rename taken", file, "taken", `{}`, false, "already exists on " + prBranch},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f, c := newFakeGitHub(t)
			f.files["main:"+photosDir+"gone.json"] = "{}"
			if tt.onMain {
				f.files["main:"+file] = "{}"
			}
			f.openPull(prBranch, map[string]string{file: "{\"a\":1}", photosDir + "taken.json": "{}"})
			delete(f.files, prBranch+":"+photosDir+"gone.json")
			_, err := c.Update(t.Context(), pullGH, tt.file, tt.rename, json.RawMessage(tt.data))
			var perr *PublishError
			if !errors.As(err, &perr) || !strings.Contains(perr.Message, tt.want) {
				t.Errorf("Update() error = %v, want one containing %q", err, tt.want)
			}
		})
	}
}

func TestUpdateRenames(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.openPull(prBranch, map[string]string{photosDir + "DSC0001.json": "{\n  \"file\": \"DSC0001.jpg\"\n}\n"})
	data := json.RawMessage(`{"title":"Night market","file":"DSC0001.jpg"}`)
	got, err := c.Update(t.Context(), pullGH, photosDir+"DSC0001.json", "Night-market.json", data)
	if err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	if got.Path != photosDir+"Night-market.json" || !got.Changed {
		t.Errorf("Update() = %+v, want it moved to Night-market.json", got)
	}
	if old, ok := stagedContent(t, c, photosDir+"DSC0001.json"); !ok || !old.Deleted {
		t.Errorf("DSC0001.json pending = %+v, want it deleted", old)
	}
	if _, err := c.CommitCombined(t.Context(), pullGH, nil); err != nil {
		t.Fatalf("CommitCombined() error = %v", err)
	}
	if _, ok := f.file(prBranch, photosDir+"DSC0001.json"); ok {
		t.Error("DSC0001.json is still on the branch")
	}
	if _, ok := f.file(prBranch, photosDir+"Night-market.json"); !ok {
		t.Error("Night-market.json isn't on the branch")
	}
	if n := f.count("POST /git/commits"); n != 1 {
		t.Errorf("made %d commits for a rename, want 1", n)
	}
}

func TestUpdateRenameTaken(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.files["main:"+photosDir+"Night-market.json"] = "{}"
	f.openPull(prBranch, map[string]string{photosDir + "DSC0001.json": "{}"})
	_, err := c.Update(t.Context(), pullGH, photosDir+"DSC0001.json", "Night-market", json.RawMessage(`{}`))
	var perr *PublishError
	if !errors.As(err, &perr) || perr.Status != http.StatusConflict || !strings.Contains(perr.Message, "already exists on main") {
		t.Errorf("Update() error = %v, want a conflict", err)
	}
}
