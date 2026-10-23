package github

import (
	"encoding/json"
	"slices"
	"testing"
)

func TestIsDraft(t *testing.T) {
	tests := map[string]bool{
		`{"title":"A"}`:    false,
		`{"title":" A "}`:  false,
		`{"title":""}`:     true,
		`{"title":"  "}`:   true,
		`{"title":null}`:   true,
		`{"title":3}`:      true,
		`{"file":"a.jpg"}`: true,
		`not json`:         false,
	}
	for data, want := range tests {
		if got := isDraft(json.RawMessage(data)); got != want {
			t.Errorf("isDraft(%s) = %v, want %v", data, got, want)
		}
	}
}

func TestCommitCombinedLeavesOutDrafts(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.openPull(prBranch, with(emptyLists, map[string]string{
		dataRoot + "/photos/a.json":         `{"file":"a.jpg","title":"A"}`,
		dataRoot + "/photos/b.json":         `{"file":"b.jpg","title":null}`,
		dataRoot + "/photos/c.json":         `{"file":"c.jpg","title":" "}`,
		dataRoot + "/photos/ALLPHOTOS.json": "[]\n",
	}))
	got, err := c.CommitCombined(t.Context(), pullGH, nil)
	if err != nil {
		t.Fatalf("CommitCombined() error = %v", err)
	}
	want := "[\n  {\n    \"file\": \"a.jpg\",\n    \"title\": \"A\"\n  }\n]\n"
	if all, _ := f.file(prBranch, dataRoot+"/photos/ALLPHOTOS.json"); all != want {
		t.Errorf("ALLPHOTOS.json = %q, want only the titled photo", all)
	}
	if got.Counts["photos"] != 1 || got.Counts["drafts"] != 2 {
		t.Errorf("counts = %v, want 1 photo and 2 drafts", got.Counts)
	}
	status, err := c.CombinedStatus(t.Context(), pullGH)
	if err != nil || status.State != CombinedSynced {
		t.Errorf("CombinedStatus() = %+v, %v; want synced, since drafts aren't missing from the list", status, err)
	}
}

func TestCommitCombinedIncludeUntitled(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.openPull(prBranch, with(emptyLists, map[string]string{
		dataRoot + "/photos/a.json":         `{"file":"a.jpg","title":"A"}`,
		dataRoot + "/photos/b.json":         `{"file":"b.jpg","title":null}`,
		dataRoot + "/photos/ALLPHOTOS.json": "[\n  {\n    \"file\": \"a.jpg\",\n    \"title\": \"A\"\n  }\n]\n",
	}))
	gh := pullGH
	gh.IncludeUntitled = true
	status, err := c.CombinedStatus(t.Context(), gh)
	want := []PendingFile{{"photos", dataRoot + "/photos/b.json", PendingAdded}}
	if err != nil || !slices.Equal(status.Pending, want) {
		t.Errorf("CombinedStatus() = %+v, %v; want b.json missing from the list", status.Pending, err)
	}
	got, err := c.CommitCombined(t.Context(), gh, nil)
	if err != nil || got.Counts["photos"] != 2 || got.Counts["drafts"] != 0 {
		t.Errorf("CommitCombined() = %+v, %v; want both photos in ALLPHOTOS.json", got, err)
	}
}

func TestCombinedStatusTitleRemoved(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.openPull(prBranch, with(emptyLists, map[string]string{
		dataRoot + "/photos/a.json":         `{"file":"a.jpg","title":""}`,
		dataRoot + "/photos/ALLPHOTOS.json": `[{"file":"a.jpg","title":"A"}]`,
	}))
	status, err := c.CombinedStatus(t.Context(), pullGH)
	want := []PendingFile{{"photos", dataRoot + "/photos/a.json", PendingModified}}
	if err != nil || status.State != CombinedStale || !slices.Equal(status.Pending, want) {
		t.Errorf("CombinedStatus() = %+v, %v; want a.json's entry still to be taken out", status, err)
	}
}
