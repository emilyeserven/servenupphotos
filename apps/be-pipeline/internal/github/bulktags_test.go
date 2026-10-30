package github

import (
	"encoding/json"
	"slices"
	"strings"
	"testing"
)

// bulkTagRepo starts a fake repo whose photo data pull request has photos,
// by file name, and the tags temple and lanterns and the genre street.
func bulkTagRepo(t *testing.T, photos map[string]string) (*fakeGitHub, *Client) {
	t.Helper()
	f, c := newFakeGitHub(t)
	files := map[string]string{
		photosDir + "ALLPHOTOS.json":           "[]\n",
		dataRoot + "/tags/temple.json":         `{"id":"temple","name":"temple","description":""}`,
		dataRoot + "/tags/lanterns.json":       `{"id":"lanterns","name":"lanterns","description":""}`,
		dataRoot + "/genres/street.json":       `{"id":"street","name":"Street","description":""}`,
		dataRoot + "/metainfo/wide-angle.json": `{"id":"wide-angle","name":"Wide angle","field":"focalLength","values":[]}`,
	}
	for name, content := range photos {
		files[photosDir+name] = content
	}
	f.openPull(prBranch, files)
	return f, c
}

func TestPickBulkTagPhotos(t *testing.T) {
	_, c := bulkTagRepo(t, map[string]string{
		"a.json": `{"tags":[],"customCity":"Kyoto","createDate":"2024:04:01 10:00:00"}`,
		"b.json": `{"tags":["temple"],"city":"Kyoto","createDate":"2024:04:01 12:00:00"}`,
		"c.json": `{"tags":[],"city":"Kyoto","createDate":"2019:01:01 00:00:00"}`,
		"g.json": `{"tags":[],"customCity":"Kyoto","createDate":"2024:04:01 18:00:00"}`,
		"d.json": `{"tags":["temple","lanterns"],"customCity":"kyoto","genres":["street"]}`,
		"e.json": `{"tags":[],"city":"Paris"}`,
		"f.json": `{"file":`,
	})
	got, err := c.PickBulkTagPhotos(t.Context(), baseURLSettings, nil, 0)
	if err != nil {
		t.Fatalf("PickBulkTagPhotos() error = %v", err)
	}
	var names []string
	for _, p := range got.Photos {
		names = append(names, p.Name)
	}
	// Photos with tags (b, d) are never picked. a is first; g shares its
	// city and day, c its city; e shares nothing with it.
	if want := []string{"a", "g", "c"}; !slices.Equal(names, want) {
		t.Errorf("picked %v, want %v", names, want)
	}
	if got.Untagged != 4 || got.PhotoFiles != 7 || got.PullRequest == nil {
		t.Errorf("PickBulkTagPhotos() = %+v, want 4 untagged of 7 photo files", got)
	}
	if r := got.Photos[1].Related; !slices.Equal(r, []string{"same city: kyoto", "taken the same day"}) {
		t.Errorf("g related = %v", r)
	}

	got, err = c.PickBulkTagPhotos(t.Context(), baseURLSettings, []string{photosDir + "a.json"}, 0)
	if err != nil || got.Photos[0].Name != "c" {
		t.Errorf("PickBulkTagPhotos(skip a) = %+v, %v; want c first", got.Photos, err)
	}

	got, err = c.PickBulkTagPhotos(t.Context(), baseURLSettings, nil, 2)
	if err != nil || len(got.Photos) != 2 {
		t.Errorf("PickBulkTagPhotos(count 2) = %+v, %v; want 2 photos", got.Photos, err)
	}
}

const bulkAnswer = "Here you go:\n```json\n" + `{
  "photos": [
    {"photo": "a", "tags": ["Shotengai", "lanterns", "street", "Wide angle", "temple"]},
    {"photo": "b", "tags": ["temple", "matsuri"]},
    {"photo": "zzz", "tags": ["cats"]}
  ],
  "definitions": [
    {"tag": "shotengai", "definition": "a Japanese shopping street", "parent": "covered-street"},
    {"tag": "matsuri", "definition": "a Japanese festival", "parent": "temple"}
  ]
}` + "\n```"

func TestPreviewBulkTags(t *testing.T) {
	_, c := bulkTagRepo(t, map[string]string{
		"a.json": `{"tags":["temple"]}`,
		"b.json": `{"tags":[]}`,
	})
	got, err := c.PreviewBulkTags(t.Context(), baseURLSettings, []string{photosDir + "a.json", photosDir + "b.json"}, bulkAnswer)
	if err != nil {
		t.Fatalf("PreviewBulkTags() error = %v", err)
	}
	a, b := got.Photos[0], got.Photos[1]
	if !slices.Equal(a.Add, []string{"shotengai", "lanterns"}) || !slices.Equal(a.Already, []string{"temple"}) {
		t.Errorf("a = %+v, want shotengai and lanterns added, temple already there", a)
	}
	if len(a.Skipped) != 2 || !strings.Contains(a.Skipped[0].Reason, "genre") || !strings.Contains(a.Skipped[1].Reason, "metadata group") {
		t.Errorf("a.Skipped = %+v, want street and Wide angle left out", a.Skipped)
	}
	if !slices.Equal(b.Add, []string{"temple", "matsuri"}) {
		t.Errorf("b.Add = %v", b.Add)
	}
	want := []BulkTagNew{
		{ID: "covered-street", ParentOnly: true},
		{ID: "shotengai", Description: "a Japanese shopping street", Parent: "covered-street"},
		{ID: "matsuri", Description: "a Japanese festival", Parent: "temple"},
	}
	if !slices.Equal(got.NewTags, want) {
		t.Errorf("NewTags = %+v, want %+v", got.NewTags, want)
	}
	if !slices.Equal(got.Unknown, []string{"zzz"}) {
		t.Errorf("Unknown = %v, want zzz", got.Unknown)
	}

	for _, bad := range []string{"no json here", `{"photos": "a"}`, `{"photos": []}`} {
		if _, err := c.PreviewBulkTags(t.Context(), baseURLSettings, []string{photosDir + "a.json"}, bad); err == nil {
			t.Errorf("PreviewBulkTags(%q) error = nil", bad)
		}
	}
}

func TestApplyBulkTags(t *testing.T) {
	f, c := bulkTagRepo(t, map[string]string{
		"a.json": "{\n  \"tags\": [\n    \"temple\"\n  ]\n}\n",
		"b.json": "{\n  \"tags\": []\n}\n",
	})
	got, err := c.ApplyBulkTags(t.Context(), baseURLSettings, BulkTags{
		// The child is listed before its parent; the parent is still made first.
		NewTags: []NewGroup{
			{ID: "shotengai", Description: "a Japanese shopping street", Parent: "covered-street"},
			{ID: "covered-street"},
		},
		Photos: []BulkTagsPhoto{
			{Path: photosDir + "a.json", Tags: []string{"shotengai", "temple"}},
			{Path: photosDir + "b.json", Tags: []string{"lanterns"}},
		},
	})
	if err != nil {
		t.Fatalf("ApplyBulkTags() error = %v", err)
	}
	if got.NewTags != 2 || got.Photos != 2 || len(got.Changes) != 4 {
		t.Errorf("ApplyBulkTags() = %+v, want 2 new tags and 2 photos", got)
	}
	if w := f.writes(); len(w) != 0 {
		t.Errorf("wrote to GitHub: %v", w)
	}
	shotengai, _ := stagedContent(t, c, dataRoot+"/tags/shotengai.json")
	var tag groupJSON
	if json.Unmarshal([]byte(shotengai.Content), &tag) != nil || tag.Parent == nil || *tag.Parent != "covered-street" || tag.Description == "" {
		t.Errorf("shotengai.json = %s", shotengai.Content)
	}
	a, _ := stagedContent(t, c, photosDir+"a.json")
	if !strings.Contains(a.Content, "\"temple\",\n    \"shotengai\"") {
		t.Errorf("a.json = %s, want shotengai after temple", a.Content)
	}
}

func TestApplyBulkTagsErrors(t *testing.T) {
	_, c := bulkTagRepo(t, map[string]string{"a.json": `{"tags":["temple"]}`})
	a := photosDir + "a.json"
	tests := []struct {
		name string
		bulk BulkTags
		want string
	}{
		{"no photos", BulkTags{}, "Tag 1 to 5"},
		{"not a tag", BulkTags{Photos: []BulkTagsPhoto{{Path: a, Tags: []string{"nope"}}}}, "isn't one of the tags"},
		{"taken name", BulkTags{NewTags: []NewGroup{{ID: "street"}}, Photos: []BulkTagsPhoto{{Path: a, Tags: []string{"street"}}}}, "already has the ID"},
		{"missing parent", BulkTags{NewTags: []NewGroup{{ID: "x", Parent: "y"}}, Photos: []BulkTagsPhoto{{Path: a, Tags: []string{"x"}}}}, "to be the parent"},
		{"nothing new", BulkTags{Photos: []BulkTagsPhoto{{Path: a, Tags: []string{"temple"}}}}, "nothing to change"},
		{"not a photo", BulkTags{Photos: []BulkTagsPhoto{{Path: photosDir + "z.json", Tags: []string{"temple"}}}}, "isn't a photo file"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := c.ApplyBulkTags(t.Context(), baseURLSettings, tt.bulk)
			if err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Errorf("ApplyBulkTags() error = %v, want %q", err, tt.want)
			}
		})
	}
	if n := pendingCount(t, c); n != 0 {
		t.Errorf("pending = %d files, want none after errors", n)
	}
}

func TestTagID(t *testing.T) {
	for in, want := range map[string]string{
		"Street Food": "street-food", "  café--crème ": "cafe-creme", "!!!": "", "wabi_sabi": "wabi-sabi",
	} {
		if got := tagID(in); got != want {
			t.Errorf("tagID(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestBulkTagCount(t *testing.T) {
	for count, want := range map[int]int{0: 5, -3: 5, 1: 1, 12: 12, 50: 50, 80: 50} {
		if got := bulkTagCount(count); got != want {
			t.Errorf("bulkTagCount(%d) = %d, want %d", count, got, want)
		}
	}
}
