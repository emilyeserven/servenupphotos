package github

import (
	"encoding/json"
	"errors"
	"maps"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

const dataRoot = "apps/portfolio/src/data"

const prBranch = "photo-data/2026-10-15-024500"

var pullGH = settings.GitHub{Repo: "owner/repo", Token: token}

// emptyLists are the combined lists of a data folder with nothing in it.
var emptyLists = map[string]string{
	dataRoot + "/photos/ALLPHOTOS.json":            "[]\n",
	dataRoot + "/albums/ALLALBUMS.json":            "[]\n",
	dataRoot + "/tags/ALLTAGS.json":                "[]\n",
	dataRoot + "/genres/ALLGENRES.json":            "[]\n",
	dataRoot + "/places/PLACES.json":               "[]\n",
	dataRoot + "/localizations/LOCALIZATIONS.json": "[]\n",
	dataRoot + "/metainfo/METAINFO.json":           "[]\n",
	dataRoot + "/cameras/CAMERAS.json":             "[]\n",
	dataRoot + "/lenses/LENSES.json":               "[]\n",
}

// with is files with more over them.
func with(files map[string]string, more map[string]string) map[string]string {
	out := maps.Clone(files)
	maps.Copy(out, more)
	return out
}

// committedTree is what the last tree made had: each path's content, "" for
// a deleted one.
func (f *fakeGitHub) committedTree() map[string]string {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := map[string]string{}
	for _, e := range f.trees["tree-"+strconv.Itoa(len(f.trees))].entries {
		content, _ := e["content"].(string)
		out[e["path"].(string)] = content
	}
	return out
}

func TestCommitCombined(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.openPull(prBranch, map[string]string{
		dataRoot + "/photos/b.json":         `{"title": "B", "albums": ["x"]}`,
		dataRoot + "/photos/a.json":         `{"title":"A"}`,
		dataRoot + "/photos/notes.txt":      `not data`,
		dataRoot + "/photos/ALLPHOTOS.json": "[]\n",
		dataRoot + "/albums/x.json":         `{"id":"x","name":"X","description":""}`,
		dataRoot + "/albums/ALLALBUMS.json": "[\n  {\n    \"id\": \"x\",\n    \"name\": \"X\",\n    \"description\": \"\"\n  }\n]\n",
	})
	got, err := c.CommitCombined(t.Context(), pullGH, nil)
	if err != nil {
		t.Fatalf("CommitCombined() error = %v", err)
	}
	wantPhotos := "[\n  {\n    \"title\": \"A\"\n  },\n  {\n    \"title\": \"B\",\n    \"albums\": [\"x\"]\n  }\n]\n"
	// ALLALBUMS.json is already up to date; the tags, genres, places, localizations, metainfo, cameras and lenses folders
	// aren't there, so their combined files are made empty.
	want := map[string]string{
		dataRoot + "/photos/ALLPHOTOS.json":            wantPhotos,
		dataRoot + "/tags/ALLTAGS.json":                "[]\n",
		dataRoot + "/genres/ALLGENRES.json":            "[]\n",
		dataRoot + "/places/PLACES.json":               "[]\n",
		dataRoot + "/localizations/LOCALIZATIONS.json": "[]\n",
		dataRoot + "/metainfo/METAINFO.json":           "[]\n",
		dataRoot + "/cameras/CAMERAS.json":             "[]\n",
		dataRoot + "/lenses/LENSES.json":               "[]\n",
	}
	if tree := f.committedTree(); !maps.Equal(tree, want) {
		t.Errorf("committed %q, want %q", tree, want)
	}
	if !got.Changed || got.CommitSHA != "commit-1" || len(got.Files) != 8 || got.NewPullRequest {
		t.Errorf("CommitCombined() = %+v, want commit-1 with eight files", got)
	}
	if got.Counts["photos"] != 2 || got.Counts["albums"] != 1 || got.Counts["tags"] != 0 {
		t.Errorf("counts = %v, want 2 photos, 1 album, 0 tags", got.Counts)
	}
	wantWrites := []string{"POST /git/trees", "POST /git/commits", "PATCH /git/refs/heads/"}
	if w := f.writes(); !slices.Equal(w, wantWrites) || !slices.Equal(f.messages, []string{CombineMessage}) {
		t.Errorf("CommitCombined() wrote %v with messages %q, want %v", w, f.messages, wantWrites)
	}
	if all, _ := f.file(prBranch, dataRoot+"/photos/ALLPHOTOS.json"); all != wantPhotos {
		t.Errorf("ALLPHOTOS.json on the branch = %q", all)
	}
}

func TestCommitCombinedUpToDate(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.openPull(prBranch, with(emptyLists, map[string]string{
		dataRoot + "/photos/a.json":         `{"title":"A"}`,
		dataRoot + "/photos/ALLPHOTOS.json": "[\n  {\n    \"title\": \"A\"\n  }\n]\n",
	}))
	got, err := c.CommitCombined(t.Context(), pullGH, nil)
	if err != nil || got.Changed || len(f.writes()) != 0 {
		t.Errorf("CommitCombined() = %+v, %v, wrote %v; want nothing committed", got, err, f.writes())
	}
}

func TestCommitCombinedNothingInFlight(t *testing.T) {
	f, c := newFakeGitHub(t)
	got, err := c.CommitCombined(t.Context(), pullGH, nil)
	if err != nil || got.Changed || len(f.writes()) != 0 {
		t.Errorf("CommitCombined() = %+v, %v, wrote %v; want nothing committed and no pull request", got, err, f.writes())
	}
}

func TestCommitCombinedUnreadable(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.openPull(prBranch, map[string]string{dataRoot + "/photos/a.json": `{"title":`})
	_, err := c.CommitCombined(t.Context(), pullGH, nil)
	var perr *PublishError
	if !errors.As(err, &perr) || !strings.Contains(perr.Message, "a.json") || len(f.writes()) != 0 {
		t.Errorf("CommitCombined() error = %v, wrote %v; want a.json named and nothing committed", err, f.writes())
	}
}

func TestCommitCombinedCommitsEveryPendingChangeAtOnce(t *testing.T) {
	f, c := newFakeGitHub(t)
	photo := "{\n  \"title\": \"A\",\n  \"file\": \"a.jpg\"\n}\n"
	f.openPull(prBranch, with(emptyLists, map[string]string{
		dataRoot + "/photos/a.json":         photo,
		dataRoot + "/photos/gone.json":      "{\n  \"file\": \"gone.jpg\"\n}\n",
		dataRoot + "/photos/ALLPHOTOS.json": "[\n  {\n    \"title\": \"A\",\n    \"file\": \"a.jpg\"\n  },\n  {\n    \"file\": \"gone.jpg\"\n  }\n]\n",
	}))
	if _, err := c.SavePlace(t.Context(), pullGH, Place{ID: "seoul-station", Name: "Seoul Station"}); err != nil {
		t.Fatalf("SavePlace() error = %v", err)
	}
	if _, err := c.Update(t.Context(), pullGH, dataRoot+"/photos/a.json", "", json.RawMessage(`{"title":"A2","file":"a.jpg"}`)); err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	if _, err := c.Remove(t.Context(), pullGH, dataRoot+"/photos/gone.json"); err != nil {
		t.Fatalf("Remove() error = %v", err)
	}
	if w := f.writes(); len(w) != 0 {
		t.Fatalf("saves wrote to GitHub: %v", w)
	}

	got, err := c.CommitCombined(t.Context(), pullGH, nil)
	if err != nil {
		t.Fatalf("CommitCombined() error = %v", err)
	}
	wantFiles := []string{
		dataRoot + "/photos/a.json", dataRoot + "/photos/gone.json", dataRoot + "/places/seoul-station.json",
		dataRoot + "/photos/ALLPHOTOS.json", dataRoot + "/places/PLACES.json",
	}
	if !slices.Equal(got.Files, wantFiles) || got.Edited != 3 {
		t.Errorf("CommitCombined() files = %v (%d edited), want %v", got.Files, got.Edited, wantFiles)
	}
	if n := f.count("POST /git/commits"); n != 1 {
		t.Errorf("made %d commits, want 1", n)
	}
	if !strings.HasSuffix(f.messages[0], "Also saves changes to 3 data files.") {
		t.Errorf("commit message = %q", f.messages[0])
	}
	if _, ok := f.file(prBranch, dataRoot+"/photos/gone.json"); ok {
		t.Error("gone.json is still on the branch")
	}
	if all, _ := f.file(prBranch, dataRoot+"/photos/ALLPHOTOS.json"); all != "[\n  {\n    \"title\": \"A2\",\n    \"file\": \"a.jpg\"\n  }\n]\n" {
		t.Errorf("ALLPHOTOS.json = %q", all)
	}

	// The commit took the pending changes, and what it committed is known without reading GitHub again.
	reads := len(f.calls)
	status, err := c.CombinedStatus(t.Context(), pullGH)
	if err != nil || status.State != CombinedSynced || len(status.Pending) != 0 {
		t.Errorf("CombinedStatus() after the commit = %+v, %v; want synced", status, err)
	}
	if len(f.calls) != reads {
		t.Errorf("CombinedStatus() after the commit called GitHub: %v", f.calls[reads:])
	}
	again, err := c.CommitCombined(t.Context(), pullGH, nil)
	if err != nil || again.Changed {
		t.Errorf("second CommitCombined() = %+v, %v; want nothing to commit", again, err)
	}
}

func TestCommitCombinedKeepsPendingChangesWhenTheBranchMoved(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.openPull(prBranch, emptyLists)
	if _, err := c.SavePlace(t.Context(), pullGH, Place{ID: "seoul-station", Name: "Seoul Station"}); err != nil {
		t.Fatalf("SavePlace() error = %v", err)
	}
	f.fail["PATCH /git/refs/heads/"] = http.StatusUnprocessableEntity
	_, err := c.CommitCombined(t.Context(), pullGH, nil)
	var perr *PublishError
	if !errors.As(err, &perr) || perr.Status != http.StatusConflict || !strings.Contains(perr.Message, "nothing was lost") {
		t.Fatalf("CommitCombined() error = %v, want a conflict", err)
	}
	delete(f.fail, "PATCH /git/refs/heads/")
	states := f.count("graphql state")
	got, err := c.CommitCombined(t.Context(), pullGH, nil)
	if err != nil || got.Edited != 1 {
		t.Errorf("CommitCombined() again = %+v, %v; want the place committed", got, err)
	}
	if n := f.count("graphql state"); n != states+1 {
		t.Errorf("state queries = %d, want %d: a refused move reads where the branch is again", n, states+1)
	}
}

func TestCommitCombinedWithEdits(t *testing.T) {
	f, c := newFakeGitHub(t)
	photo := "{\n  \"title\": \"A\",\n  \"socialMediaPublishDate\": null\n}\n"
	f.openPull(prBranch, with(emptyLists, map[string]string{
		dataRoot + "/photos/a.json":         photo,
		dataRoot + "/photos/ALLPHOTOS.json": "[\n  {\n    \"title\": \"A\",\n    \"socialMediaPublishDate\": null\n  }\n]\n",
	}))
	edits := []FieldEdit{{Path: dataRoot + "/photos/a.json", Fields: map[string]json.RawMessage{"socialMediaPublishDate": json.RawMessage(`"2026-10-30"`)}}}
	got, err := c.CommitCombined(t.Context(), pullGH, edits)
	if err != nil {
		t.Fatalf("CommitCombined() error = %v", err)
	}
	wantPhoto := strings.Replace(photo, "null", `"2026-10-30"`, 1)
	wantAll := "[\n  {\n    \"title\": \"A\",\n    \"socialMediaPublishDate\": \"2026-10-30\"\n  }\n]\n"
	tree := f.committedTree()
	if tree[dataRoot+"/photos/a.json"] != wantPhoto || tree[dataRoot+"/photos/ALLPHOTOS.json"] != wantAll || len(tree) != 2 {
		t.Errorf("committed %q, want a.json and ALLPHOTOS.json with the new date", tree)
	}
	if got.Edited != 1 || len(got.Files) != 2 || !strings.HasPrefix(f.messages[0], CombineMessage+"\n\n") {
		t.Errorf("CommitCombined() = %+v, message %q; want one edited file under the combine message", got, f.messages)
	}
}

func TestCommitCombinedEditsOpenThePullRequest(t *testing.T) {
	f, c := newFakeGitHub(t)
	for p, v := range with(emptyLists, map[string]string{
		dataRoot + "/photos/a.json":         "{\n  \"title\": \"A\"\n}\n",
		dataRoot + "/photos/ALLPHOTOS.json": "[\n  {\n    \"title\": \"A\"\n  }\n]\n",
	}) {
		f.files["main:"+p] = v
	}
	edits := []FieldEdit{{Path: dataRoot + "/photos/a.json", Fields: map[string]json.RawMessage{"title": json.RawMessage(`"B"`)}}}
	got, err := c.CommitCombined(t.Context(), pullGH, edits)
	if err != nil || !got.NewPullRequest || got.Edited != 1 {
		t.Fatalf("CommitCombined() = %+v, %v; want a new pull request with the edit", got, err)
	}
	if main, _ := f.file("main", dataRoot+"/photos/a.json"); main != "{\n  \"title\": \"A\"\n}\n" {
		t.Errorf("main was changed: %q", main)
	}
}

func TestCommitCombinedSkipsAnEditOfAMissingFile(t *testing.T) {
	f, c := newFakeGitHub(t)
	photo := "{\n  \"title\": \"A\"\n}\n"
	f.openPull(prBranch, with(emptyLists, map[string]string{dataRoot + "/photos/a.json": photo}))
	edits := []FieldEdit{
		{Path: dataRoot + "/photos/gone.json", Fields: map[string]json.RawMessage{"title": json.RawMessage(`"B"`)}},
		{Path: dataRoot + "/photos/a.json", Fields: map[string]json.RawMessage{"title": json.RawMessage(`"C"`)}},
	}
	got, err := c.CommitCombined(t.Context(), pullGH, edits)
	if err != nil {
		t.Fatalf("CommitCombined() error = %v", err)
	}
	if len(got.Skipped) != 1 || got.Skipped[0].Path != dataRoot+"/photos/gone.json" || got.Edited != 1 {
		t.Errorf("CommitCombined() = %+v; want gone.json skipped and a.json committed", got)
	}
	if tree := f.committedTree(); !strings.Contains(tree[dataRoot+"/photos/a.json"], `"C"`) {
		t.Errorf("committed %q, want a.json with the new title", tree)
	}
	if n := f.count("graphql state"); n != 1 {
		t.Errorf("state queries = %d, want 1", n)
	}
}

func TestCommitCombinedRereadsWhenAnEditedFileIsMissing(t *testing.T) {
	f, c := newFakeGitHub(t)
	for p, v := range emptyLists {
		f.files["main:"+p] = v
	}
	if _, err := c.CombinedStatus(t.Context(), pullGH); err != nil {
		t.Fatalf("CombinedStatus() error = %v", err)
	}
	// The photo data pull request that added a.json was merged on GitHub
	// after the pipeline read where main was.
	photo := "{\n  \"title\": \"A\"\n}\n"
	f.moveMain(map[string]string{dataRoot + "/photos/a.json": photo, dataRoot + "/photos/ALLPHOTOS.json": "[\n  {\n    \"title\": \"A\"\n  }\n]\n"})
	edits := []FieldEdit{{Path: dataRoot + "/photos/a.json", Fields: map[string]json.RawMessage{"title": json.RawMessage(`"B"`)}}}
	got, err := c.CommitCombined(t.Context(), pullGH, edits)
	if err != nil || len(got.Skipped) != 0 || got.Edited != 1 || !got.NewPullRequest {
		t.Fatalf("CommitCombined() = %+v, %v; want the edit committed on a new pull request", got, err)
	}
	if tree := f.committedTree(); !strings.Contains(tree[dataRoot+"/photos/a.json"], `"B"`) {
		t.Errorf("committed %q, want a.json with the new title", tree)
	}
}

func TestCommitCombinedOpensANewPullRequestWhenTheOldOneWasMerged(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.openPull(prBranch, emptyLists)
	if _, err := c.CombinedStatus(t.Context(), pullGH); err != nil {
		t.Fatalf("CombinedStatus() error = %v", err)
	}
	// The photo data pull request was merged on GitHub after the pipeline
	// read it; its branch is still there.
	f.pulls = nil
	f.moveMain(emptyLists)
	if _, err := c.SavePlace(t.Context(), pullGH, Place{ID: "seoul-station", Name: "Seoul Station"}); err != nil {
		t.Fatalf("SavePlace() error = %v", err)
	}
	got, err := c.CommitCombined(t.Context(), pullGH, nil)
	if err != nil || !got.NewPullRequest || got.Edited != 1 {
		t.Fatalf("CommitCombined() = %+v, %v; want the place on a new pull request", got, err)
	}
	if f.versions[prBranch] != 1 {
		t.Errorf("the merged pull request's branch was moved to %s", f.head(prBranch))
	}
}

func TestCombinedStatus(t *testing.T) {
	f, c := newFakeGitHub(t)
	got, err := c.CombinedStatus(t.Context(), pullGH)
	if err != nil || got.State != CombinedNoPullRequest {
		t.Errorf("CombinedStatus() with nothing in flight = %+v, %v; want none", got, err)
	}

	f.openPull(prBranch, with(emptyLists, map[string]string{
		dataRoot + "/photos/a.json":         "{\n  \"file\": \"a.jpg\",\n  \"title\": \"A\"\n}\n",
		dataRoot + "/photos/ALLPHOTOS.json": "[\n  {\n    \"file\": \"a.jpg\",\n    \"title\": \"A\"\n  }\n]\n",
	}))
	_ = c.Refresh(t.Context(), pullGH)
	got, err = c.CombinedStatus(t.Context(), pullGH)
	if err != nil || got.State != CombinedSynced || got.HeadSHA != prBranch+"@1" {
		t.Errorf("CombinedStatus() = %+v, %v; want synced at the head", got, err)
	}
}

func TestCombinedStatusPending(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.files["main:"+dataRoot+"/localizations/city-seoul.json"] = `{"id":"city-seoul"}`
	f.openPull(prBranch, with(emptyLists, map[string]string{
		// Pushed without rebuilding the lists: a.json changed, b.json is new, and city-seoul is gone.
		dataRoot + "/photos/a.json":                    `{"file":"a.jpg","title":"New"}`,
		dataRoot + "/photos/b.json":                    `{"file":"b.jpg","title":"B"}`,
		dataRoot + "/photos/c.json":                    `{"file":"c.jpg","title":"C"}`,
		dataRoot + "/photos/ALLPHOTOS.json":            `[{"file":"a.jpg","title":"Old"},{"file":"c.jpg","title":"C"}]`,
		dataRoot + "/localizations/LOCALIZATIONS.json": `[{"id":"city-seoul"}]`,
	}))
	delete(f.files, prBranch+":"+dataRoot+"/localizations/city-seoul.json")
	if _, err := c.SavePlace(t.Context(), pullGH, Place{ID: "x", Name: "X"}); err != nil {
		t.Fatalf("SavePlace() error = %v", err)
	}
	if _, err := c.Remove(t.Context(), pullGH, dataRoot+"/photos/b.json"); err != nil {
		t.Fatalf("Remove() error = %v", err)
	}
	if _, err := c.Remove(t.Context(), pullGH, dataRoot+"/photos/c.json"); err != nil {
		t.Fatalf("Remove() error = %v", err)
	}
	got, err := c.CombinedStatus(t.Context(), pullGH)
	want := []PendingFile{
		{"localizations", dataRoot + "/localizations/city-seoul", PendingDeleted},
		{"photos", dataRoot + "/photos/a.json", PendingModified},
		{"photos", dataRoot + "/photos/c.json", PendingDeleted},
		{"places", dataRoot + "/places/x.json", PendingAdded},
	}
	if err != nil || got.State != CombinedStale || !slices.Equal(got.Pending, want) {
		t.Errorf("CombinedStatus() = %+v, %v; want stale with %+v", got.Pending, err, want)
	}
	if len(got.Changes) != 3 {
		t.Errorf("CombinedStatus() changes = %+v, want the 3 pending changes", got.Changes)
	}
}

func TestApplyEditList(t *testing.T) {
	content := []byte("{\n  \"title\": \"A\",\n  \"spotlightZones\": []\n}\n")
	edit := FieldEdit{Fields: map[string]json.RawMessage{"spotlightZones": json.RawMessage(`["homepage"]`)}}
	got, err := applyEdit(content, edit)
	if err != nil {
		t.Fatal(err)
	}
	want := "{\n  \"title\": \"A\",\n  \"spotlightZones\": [\n    \"homepage\"\n  ]\n}\n"
	if string(got) != want {
		t.Errorf("applyEdit = %q, want %q", got, want)
	}
	// A file without the field gets it added.
	got, err = applyEdit([]byte("{\n  \"title\": \"A\"\n}\n"), edit)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != want {
		t.Errorf("applyEdit without the field = %q, want %q", got, want)
	}
}

func TestApplyEditObjectAndBack(t *testing.T) {
	content := []byte("{\n  \"spotlightFocus\": null\n}\n")
	set := FieldEdit{Fields: map[string]json.RawMessage{"spotlightFocus": json.RawMessage(`{"x":25,"y":50}`)}}
	got, err := applyEdit(content, set)
	if err != nil {
		t.Fatal(err)
	}
	want := "{\n  \"spotlightFocus\": {\n    \"x\": 25,\n    \"y\": 50\n  }\n}\n"
	if string(got) != want {
		t.Fatalf("applyEdit = %q, want %q", got, want)
	}
	// An object goes back to null.
	unset := FieldEdit{Fields: map[string]json.RawMessage{"spotlightFocus": json.RawMessage(`null`)}}
	if got, err = applyEdit(got, unset); err != nil {
		t.Fatal(err)
	}
	if string(got) != string(content) {
		t.Errorf("applyEdit back = %q, want %q", got, content)
	}
}
