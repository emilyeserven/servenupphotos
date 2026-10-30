package github

import (
	"encoding/json"
	"slices"
	"strings"
	"testing"
)

// pruneTagRepo starts a fake repo whose photo data pull request has the tags
// temple, shrine (under temple), torii (under shrine), lanterns, lamps and
// chochin (under lanterns), and photos a to c.
func pruneTagRepo(t *testing.T, photos map[string]string) (*fakeGitHub, *Client) {
	t.Helper()
	f, c := newFakeGitHub(t)
	files := map[string]string{
		photosDir + "ALLPHOTOS.json":     "[]\n",
		dataRoot + "/tags/temple.json":   `{"id":"temple","name":"temple","description":""}`,
		dataRoot + "/tags/shrine.json":   "{\n  \"id\": \"shrine\",\n  \"name\": \"shrine\",\n  \"description\": \"\",\n  \"parent\": \"temple\"\n}\n",
		dataRoot + "/tags/torii.json":    "{\n  \"id\": \"torii\",\n  \"name\": \"torii\",\n  \"description\": \"\",\n  \"parent\": \"shrine\"\n}\n",
		dataRoot + "/tags/lanterns.json": `{"id":"lanterns","name":"lanterns","description":""}`,
		dataRoot + "/tags/lamps.json":    `{"id":"lamps","name":"lamps","description":""}`,
		dataRoot + "/tags/chochin.json":  "{\n  \"id\": \"chochin\",\n  \"name\": \"chochin\",\n  \"description\": \"\",\n  \"parent\": \"lanterns\"\n}\n",
	}
	for name, content := range photos {
		files[photosDir+name] = content
	}
	f.openPull(prBranch, files)
	return f, c
}

var prunePhotos = map[string]string{
	"a.json": "{\n  \"tags\": [\n    \"lanterns\",\n    \"lamps\",\n    \"shrine\"\n  ]\n}\n",
	"b.json": "{\n  \"tags\": [\n    \"torii\"\n  ]\n}\n",
	"c.json": "{\n  \"tags\": [\n    \"lanterns\"\n  ]\n}\n",
}

const pruneAnswer = "```json\n" + `{
  "merge": [
    {"tag": "Lanterns", "into": "lamps", "reason": "the same thing"},
    {"tag": "lamps", "into": "lanterns", "reason": "the other way round"}
  ],
  "remove": [
    {"tag": "shrine", "reason": "too close to temple"},
    {"tag": "cats", "reason": "not a tag"}
  ],
  "reparent": [
    {"tag": "torii", "parent": "lamps", "reason": "a test"},
    {"tag": "lamps", "parent": "chochin", "reason": "a loop"},
    {"tag": "chochin", "parent": "lamps", "reason": "already there once lanterns is merged"},
    {"tag": "temple", "parent": null, "reason": "already at the top"}
  ]
}` + "\n```"

func TestPreviewPruneTags(t *testing.T) {
	_, c := pruneTagRepo(t, prunePhotos)
	got, err := c.PreviewPruneTags(t.Context(), baseURLSettings, pruneAnswer)
	if err != nil {
		t.Fatalf("PreviewPruneTags() error = %v", err)
	}
	if got.Tags != 6 {
		t.Errorf("Tags = %d, want 6", got.Tags)
	}
	wantMerge := PruneTagMerge{Tag: "lanterns", Into: "lamps", Reason: "the same thing", Photos: 2, Children: []string{"chochin"}}
	if len(got.Merge) != 1 || got.Merge[0].Tag != wantMerge.Tag || got.Merge[0].Photos != 2 || !slices.Equal(got.Merge[0].Children, wantMerge.Children) {
		t.Errorf("Merge = %+v, want only %+v", got.Merge, wantMerge)
	}
	if len(got.Remove) != 1 || got.Remove[0].Tag != "shrine" || got.Remove[0].Photos != 1 || !slices.Equal(got.Remove[0].Children, []string{"torii"}) {
		t.Errorf("Remove = %+v, want shrine with 1 photo and torii under it", got.Remove)
	}
	if len(got.Reparent) != 1 || got.Reparent[0] != (PruneTagReparent{Tag: "torii", From: "temple", Parent: "lamps", Reason: "a test"}) {
		t.Errorf("Reparent = %+v, want torii from temple (shrine's parent) to lamps", got.Reparent)
	}
	var skipped []string
	for _, s := range got.Skipped {
		skipped = append(skipped, s.Change+": "+s.Reason)
	}
	want := []string{
		`merge lamps into lanterns: "lanterns" is merged into "lamps" already`,
		`remove cats: "cats" isn't a tag`,
		`put lamps under chochin: it would put "lamps" inside itself`,
		"put chochin under lamps: it's there already",
		"move temple to the top level: it's there already",
	}
	if !slices.Equal(skipped, want) {
		t.Errorf("Skipped =\n%s\nwant\n%s", strings.Join(skipped, "\n"), strings.Join(want, "\n"))
	}

	for _, bad := range []string{"no json", `{"merge": "x"}`, `{}`} {
		if _, err := c.PreviewPruneTags(t.Context(), baseURLSettings, bad); err == nil {
			t.Errorf("PreviewPruneTags(%q) error = nil", bad)
		}
	}
}

func TestApplyPruneTags(t *testing.T) {
	f, c := pruneTagRepo(t, prunePhotos)
	got, err := c.ApplyPruneTags(t.Context(), baseURLSettings, PruneTags{
		Merge:  []TagMerge{{Tag: "lanterns", Into: "lamps"}},
		Remove: []string{"shrine"},
	})
	if err != nil {
		t.Fatalf("ApplyPruneTags() error = %v", err)
	}
	// lanterns and shrine deleted; chochin and torii get new parents; a and
	// c change, and b keeps torii.
	if got.Deleted != 2 || got.Reparented != 2 || got.Photos != 2 {
		t.Errorf("ApplyPruneTags() = %+v, want 2 deleted, 2 reparented, 2 photos", got)
	}
	if w := f.writes(); len(w) != 0 {
		t.Errorf("wrote to GitHub: %v", w)
	}
	if lanterns, ok := stagedContent(t, c, dataRoot+"/tags/lanterns.json"); !ok || !lanterns.Deleted {
		t.Errorf("lanterns.json = %+v, want deleted", lanterns)
	}
	wantParent(t, c, "chochin", "lamps")
	wantParent(t, c, "torii", "temple")
	a, _ := stagedContent(t, c, photosDir+"a.json")
	if a.Content != "{\n  \"tags\": [\n    \"lamps\"\n  ]\n}\n" {
		t.Errorf("a.json = %q, want only lamps", a.Content)
	}
	cc, _ := stagedContent(t, c, photosDir+"c.json")
	if !strings.Contains(cc.Content, `"lamps"`) {
		t.Errorf("c.json = %q, want lamps", cc.Content)
	}
	if _, ok := stagedContent(t, c, photosDir+"b.json"); ok {
		t.Error("b.json changed, want it kept")
	}
}

// wantParent checks the staged tag file for id has parent.
func wantParent(t *testing.T, c *Client, id, parent string) {
	t.Helper()
	file, _ := stagedContent(t, c, dataRoot+"/tags/"+id+".json")
	var tag groupJSON
	if json.Unmarshal([]byte(file.Content), &tag) != nil || tag.Parent == nil || *tag.Parent != parent {
		t.Errorf("%s.json = %s, want parent %s", id, file.Content, parent)
	}
}

func TestApplyPruneTagsErrors(t *testing.T) {
	tests := []struct {
		name string
		req  PruneTags
		want string
	}{
		{"nothing", PruneTags{}, "at least one"},
		{"not a tag", PruneTags{Remove: []string{"cats"}}, "isn't a tag"},
		{"into itself", PruneTags{Merge: []TagMerge{{Tag: "lamps", Into: "lamps"}}}, "into itself"},
		{"removed target", PruneTags{Merge: []TagMerge{{Tag: "lamps", Into: "lanterns"}}, Remove: []string{"lanterns"}}, "merged into it"},
		{"loop", PruneTags{Reparent: []TagReparent{{Tag: "temple", Parent: "torii"}}}, "inside itself"},
		{"merge into child", PruneTags{Merge: []TagMerge{{Tag: "shrine", Into: "torii"}}}, "inside itself"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, c := pruneTagRepo(t, prunePhotos)
			_, err := c.ApplyPruneTags(t.Context(), baseURLSettings, tt.req)
			if err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Errorf("ApplyPruneTags() error = %v, want %q", err, tt.want)
			}
			if n := pendingCount(t, c); n != 0 {
				t.Errorf("pending = %d files, want none after an error", n)
			}
		})
	}

	_, c := pruneTagRepo(t, map[string]string{"a.json": `{"tags":`})
	if _, err := c.ApplyPruneTags(t.Context(), baseURLSettings, PruneTags{Remove: []string{"lamps"}}); err == nil || !strings.Contains(err.Error(), "couldn't be read") {
		t.Errorf("ApplyPruneTags() with an unreadable photo error = %v", err)
	}
}

func TestApplyPruneTagsChains(t *testing.T) {
	_, c := pruneTagRepo(t, prunePhotos)
	// lanterns into lamps, then lamps into temple: a's lanterns and lamps both
	// end up temple, once.
	_, err := c.ApplyPruneTags(t.Context(), baseURLSettings, PruneTags{
		Merge: []TagMerge{{Tag: "lanterns", Into: "lamps"}, {Tag: "lamps", Into: "temple"}},
	})
	if err != nil {
		t.Fatalf("ApplyPruneTags() error = %v", err)
	}
	a, _ := stagedContent(t, c, photosDir+"a.json")
	if a.Content != "{\n  \"tags\": [\n    \"temple\",\n    \"shrine\"\n  ]\n}\n" {
		t.Errorf("a.json = %q, want temple and shrine", a.Content)
	}
	wantParent(t, c, "chochin", "temple")
}
