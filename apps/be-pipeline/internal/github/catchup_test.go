package github

import (
	"testing"
)

// TestCommitCombinedCatchesUp has main add an empty CAMERAS.json, a photo and
// a code file after the pull request added a camera, which would conflict
// with the pull request's CAMERAS.json, and change a photo the pull request
// changed too. Commit merges main in instead, with the pull request's photo
// and the combined lists rebuilt from both.
func TestCommitCombinedCatchesUp(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.openPull(prBranch, map[string]string{
		dataRoot + "/photos/a.json":         `{"title":"A"}`,
		dataRoot + "/photos/ALLPHOTOS.json": "[\n  {\n    \"title\": \"A\"\n  }\n]\n",
		dataRoot + "/cameras/x-t5.json":     `{"id":"x-t5"}`,
		dataRoot + "/cameras/CAMERAS.json":  "[\n  {\n    \"id\": \"x-t5\"\n  }\n]\n",
		dataRoot + "/photos/old.json":       `{"title":"Old"}`,
	})
	f.moveMain(with(emptyLists, map[string]string{
		"README.md":                         "new code",
		dataRoot + "/photos/a.json":         `{"title":"Main's A"}`,
		dataRoot + "/photos/m.json":         `{"title":"M"}`,
		dataRoot + "/photos/ALLPHOTOS.json": "[\n  {\n    \"title\": \"M\"\n  }\n]\n",
	}))
	got, err := c.CommitCombined(t.Context(), pullGH, nil)
	if err != nil || !got.Changed {
		t.Fatalf("CommitCombined() = %+v, %v; want a merge commit", got, err)
	}
	if commit := f.commits[got.CommitSHA]; commit.merges != f.head("main") {
		t.Errorf("commit's second parent = %q, want main's head %q", commit.merges, f.head("main"))
	}
	want := map[string]string{
		"README.md":                         "new code",
		dataRoot + "/photos/a.json":         `{"title":"A"}`,
		dataRoot + "/photos/m.json":         `{"title":"M"}`,
		dataRoot + "/photos/old.json":       `{"title":"Old"}`,
		dataRoot + "/photos/ALLPHOTOS.json": "[\n  {\n    \"title\": \"A\"\n  },\n  {\n    \"title\": \"M\"\n  },\n  {\n    \"title\": \"Old\"\n  }\n]\n",
		dataRoot + "/cameras/x-t5.json":     `{"id":"x-t5"}`,
		dataRoot + "/cameras/CAMERAS.json":  "[\n  {\n    \"id\": \"x-t5\"\n  }\n]\n",
	}
	for p, content := range want {
		if have, _ := f.file(prBranch, p); have != content {
			t.Errorf("%s on the branch = %q, want %q", p, have, content)
		}
	}
	again, err := c.CommitCombined(t.Context(), pullGH, nil)
	if err != nil || again.Changed {
		t.Errorf("second CommitCombined() = %+v, %v; want nothing to commit", again, err)
	}
}

// TestCommitCombinedUpToDateMakesNoMerge expects a pull request with every
// commit of main to be committed to as before, with one parent.
func TestCommitCombinedUpToDateMakesNoMerge(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.openPull(prBranch, map[string]string{dataRoot + "/photos/a.json": `{"title":"A"}`})
	got, err := c.CommitCombined(t.Context(), pullGH, nil)
	if err != nil || !got.Changed {
		t.Fatalf("CommitCombined() = %+v, %v", got, err)
	}
	if commit := f.commits[got.CommitSHA]; commit.merges != "" {
		t.Errorf("commit merges %q, want no merge", commit.merges)
	}
	if n := f.count("GET /pulls/files"); n != 0 {
		t.Errorf("read the pull request's files %d times, want 0", n)
	}
}

// TestCommitCombinedCatchesUpDeletingPullOnlyFile removes a photo only the
// pull request added while main has moved on. The merge's tree is made on
// main's, which doesn't have the photo, so the tree mustn't delete it (GitHub
// answers 422 to that); the photo is left out instead.
func TestCommitCombinedCatchesUpDeletingPullOnlyFile(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.openPull(prBranch, map[string]string{
		dataRoot + "/photos/a.json":         `{"title":"A"}`,
		dataRoot + "/photos/b.json":         `{"title":"B"}`,
		dataRoot + "/photos/ALLPHOTOS.json": "[]\n",
	})
	f.moveMain(with(emptyLists, map[string]string{"README.md": "new code"}))
	if _, err := c.Remove(t.Context(), pullGH, dataRoot+"/photos/b.json"); err != nil {
		t.Fatal(err)
	}
	got, err := c.CommitCombined(t.Context(), pullGH, nil)
	if err != nil || !got.Changed {
		t.Fatalf("CommitCombined() = %+v, %v; want a merge commit", got, err)
	}
	if _, ok := f.file(prBranch, dataRoot+"/photos/b.json"); ok {
		t.Error("b.json is still on the branch, want it removed")
	}
	if have, _ := f.file(prBranch, dataRoot+"/photos/a.json"); have != `{"title":"A"}` {
		t.Errorf("a.json on the branch = %q, want the pull request's", have)
	}
}
