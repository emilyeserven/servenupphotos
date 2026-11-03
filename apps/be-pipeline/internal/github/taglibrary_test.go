package github

import (
	"encoding/json"
	"slices"
	"strings"
	"testing"
)

const libraryAnswer = "Here you go:\n```json\n" + `{
  "newTags": [
    {"tag": "Paper Lanterns", "description": "lanterns of paper", "parent": "lanterns", "reason": "a kind of lantern"},
    {"tag": "temple", "reason": "already a tag"}
  ],
  "rename": [{"tag": "lamps", "to": "lamp", "reason": "singular"}],
  "merge": [{"tag": "chochin", "into": "paper-lanterns", "reason": "the same"}],
  "remove": [{"tag": "torii", "reason": "too few photos"}],
  "reparent": [{"tag": "shrine", "parent": null, "reason": "not a temple"}],
  "describe": [{"tag": "lamp", "description": "  a lamp  "}, {"tag": "cats", "description": "x"}],
  "photos": [
    {"photo": "a", "add": ["paper-lanterns", "lamps"], "remove": ["shrine"], "reason": "it shows paper lanterns"},
    {"photo": "nope", "add": ["temple"]},
    {"photo": "c.json", "add": ["lanterns"]}
  ],
  "notes": [{"photo": "b", "note": "Has a torii gate; torii was dropped as a tag with one photo."}]
}` + "\n```"

func TestPreviewTagLibrary(t *testing.T) {
	_, c := pruneTagRepo(t, prunePhotos)
	got, err := c.PreviewTagLibrary(t.Context(), baseURLSettings, libraryAnswer)
	if err != nil {
		t.Fatalf("PreviewTagLibrary() error = %v", err)
	}
	if got.Tags != 6 || got.Photos != 3 || got.MinPhotos != 3 {
		t.Errorf("Tags, Photos, MinPhotos = %d, %d, %d, want 6, 3, 3", got.Tags, got.Photos, got.MinPhotos)
	}
	if len(got.NewTags) != 1 || got.NewTags[0] != (TagLibraryNewTag{Tag: "paper-lanterns", Description: "lanterns of paper", Parent: "lanterns", Reason: "a kind of lantern"}) {
		t.Errorf("NewTags = %+v, want paper-lanterns under lanterns", got.NewTags)
	}
	if len(got.Rename) != 1 || got.Rename[0].To != "lamp" || got.Rename[0].Photos != 1 {
		t.Errorf("Rename = %+v, want lamps to lamp with 1 photo", got.Rename)
	}
	if len(got.Merge) != 1 || len(got.Remove) != 1 || len(got.Reparent) != 1 || got.Reparent[0].From != "temple" {
		t.Errorf("Merge, Remove, Reparent = %+v, %+v, %+v", got.Merge, got.Remove, got.Reparent)
	}
	if len(got.Describe) != 1 || got.Describe[0].Description != "a lamp" {
		t.Errorf("Describe = %+v, want lamp's", got.Describe)
	}
	// a had lanterns, lamps (now lamp) and shrine: it loses shrine and gets
	// paper-lanterns; lamps is lamp already.
	wantEdit := TagLibraryPhotoEdit{Photo: "a", Path: photosDir + "a.json", Add: []string{"paper-lanterns"}, Remove: []string{"shrine"}, Reason: "it shows paper lanterns", Tags: []string{"lanterns", "lamp", "shrine"}}
	if len(got.Edits) != 1 || !slices.Equal(got.Edits[0].Add, wantEdit.Add) || !slices.Equal(got.Edits[0].Remove, wantEdit.Remove) || !slices.Equal(got.Edits[0].Tags, wantEdit.Tags) {
		t.Errorf("Edits = %+v, want %+v", got.Edits, wantEdit)
	}
	if len(got.Notes) != 1 || got.Notes[0].Photo != "b" {
		t.Errorf("Notes = %+v, want one for b", got.Notes)
	}
	var skipped []string
	for _, s := range got.Skipped {
		skipped = append(skipped, s.Change+": "+s.Reason)
	}
	want := []string{
		`make temple: The tag "temple" already has the ID "temple". Pick another ID`,
		`describe cats: "cats" isn't a tag`,
		"change the tags of nope: it isn't a readable photo file",
		"change the tags of c: it has those tags already",
	}
	if !slices.Equal(skipped, want) {
		t.Errorf("Skipped =\n%s\nwant\n%s", strings.Join(skipped, "\n"), strings.Join(want, "\n"))
	}
	var few []string
	for _, f := range got.FewPhotos {
		few = append(few, f.Tag)
	}
	// After the changes: lanterns on a and c, lamp and paper-lanterns on a,
	// temple and shrine on none.
	if !slices.Equal(few, []string{"lamp", "lanterns", "paper-lanterns", "shrine", "temple"}) {
		t.Errorf("FewPhotos = %v", few)
	}
	if got.FewPhotos[1].Tag != "lanterns" || !slices.Equal(got.FewPhotos[1].PhotoNames, []string{"a", "c"}) {
		t.Errorf("lanterns' PhotoNames = %v, want a and c", got.FewPhotos[1].PhotoNames)
	}
	if got.FewPhotos[3].PhotoNames == nil || len(got.FewPhotos[3].PhotoNames) != 0 {
		t.Errorf("shrine's PhotoNames = %#v, want empty", got.FewPhotos[3].PhotoNames)
	}
}

func TestApplyTagLibrary(t *testing.T) {
	f, c := pruneTagRepo(t, prunePhotos)
	got, err := c.ApplyTagLibrary(t.Context(), baseURLSettings, TagLibrary{
		NewTags:   []NewGroup{{ID: "paper-lanterns", Description: "lanterns of paper", Parent: "lanterns"}},
		Rename:    []TagRename{{Tag: "lamps", To: "lamp"}},
		PruneTags: PruneTags{Merge: []TagMerge{{Tag: "chochin", Into: "paper-lanterns"}}, Remove: []string{"torii"}},
		Describe:  []TagDescribe{{Tag: "temple", Description: "a place of worship"}},
		Photos:    []TagLibraryPhoto{{Path: photosDir + "a.json", Add: []string{"paper-lanterns"}, Remove: []string{"shrine"}}},
		Notes:     []PhotoNote{{Path: photosDir + "b.json", Note: "Has a torii gate."}},
	})
	if err != nil {
		t.Fatalf("ApplyTagLibrary() error = %v", err)
	}
	// Made paper-lanterns and lamp; deleted lamps, chochin and torii;
	// described temple; a's and b's files changed.
	if got.Made != 2 || got.Deleted != 3 || got.Edited != 1 || got.Photos != 2 {
		t.Errorf("ApplyTagLibrary() = %+v, want 2 made, 3 deleted, 1 edited, 2 photos", got)
	}
	if w := f.writes(); len(w) != 0 {
		t.Errorf("wrote to GitHub: %v", w)
	}
	wantParent(t, c, "paper-lanterns", "lanterns")
	lamp, _ := stagedContent(t, c, dataRoot+"/tags/lamp.json")
	var tag groupJSON
	if json.Unmarshal([]byte(lamp.Content), &tag) != nil || tag.ID != "lamp" || tag.Name != "lamp" || tag.Parent != nil {
		t.Errorf("lamp.json = %s, want a top-level tag lamp", lamp.Content)
	}
	temple, _ := stagedContent(t, c, dataRoot+"/tags/temple.json")
	if !strings.Contains(temple.Content, `"description":"a place of worship"`) {
		t.Errorf("temple.json = %s, want the new description", temple.Content)
	}
	a, _ := stagedContent(t, c, photosDir+"a.json")
	if a.Content != "{\n  \"tags\": [\n    \"lanterns\",\n    \"lamp\",\n    \"paper-lanterns\"\n  ]\n}\n" {
		t.Errorf("a.json = %q", a.Content)
	}
	b, _ := stagedContent(t, c, photosDir+"b.json")
	if !strings.Contains(b.Content, `"notes": "Has a torii gate."`) || strings.Contains(b.Content, "torii\"\n") {
		t.Errorf("b.json = %q, want the note and torii taken off", b.Content)
	}
}

func TestApplyTagLibraryAppendsNotes(t *testing.T) {
	_, c := pruneTagRepo(t, map[string]string{"a.json": "{\n  \"tags\": [],\n  \"notes\": \"Old note.\"\n}\n"})
	_, err := c.ApplyTagLibrary(t.Context(), baseURLSettings, TagLibrary{Notes: []PhotoNote{{Path: photosDir + "a.json", Note: "New note."}}})
	if err != nil {
		t.Fatalf("ApplyTagLibrary() error = %v", err)
	}
	a, _ := stagedContent(t, c, photosDir+"a.json")
	if !strings.Contains(a.Content, `"notes": "Old note.\n\nNew note."`) {
		t.Errorf("a.json = %q, want both notes", a.Content)
	}
}

func TestApplyTagLibraryErrors(t *testing.T) {
	tests := []struct {
		name string
		req  TagLibrary
		want string
	}{
		{"nothing", TagLibrary{}, "at least one"},
		{"taken ID", TagLibrary{NewTags: []NewGroup{{ID: "lamps"}}}, "already has the ID"},
		{"bad parent", TagLibrary{NewTags: []NewGroup{{ID: "x", Parent: "cats"}}}, "isn't a tag"},
		{"unknown photo", TagLibrary{Photos: []TagLibraryPhoto{{Path: "z.json", Add: []string{"lamps"}}}}, "readable photo"},
		{"removed tag", TagLibrary{PruneTags: PruneTags{Remove: []string{"lamps"}}, Photos: []TagLibraryPhoto{{Path: photosDir + "b.json", Add: []string{"lamps"}}}}, "is removed"},
		{"empty note", TagLibrary{Notes: []PhotoNote{{Path: photosDir + "b.json", Note: " "}}}, "empty"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, c := pruneTagRepo(t, prunePhotos)
			_, err := c.ApplyTagLibrary(t.Context(), baseURLSettings, tt.req)
			if err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Errorf("ApplyTagLibrary() error = %v, want %q", err, tt.want)
			}
			if n := pendingCount(t, c); n != 0 {
				t.Errorf("pending = %d files, want none after an error", n)
			}
		})
	}
}

func TestExportTagLibrary(t *testing.T) {
	photos := map[string]string{
		"a.json": `{"id":7,"title":"Lanterns","city":"Kyoto","customCountry":"Japan","tags":["lanterns"],"notes":"for me"}`,
		"b.json": `{"tags":`,
	}
	_, c := pruneTagRepo(t, photos)
	got, err := c.ExportTagLibrary(t.Context(), baseURLSettings)
	if err != nil {
		t.Fatalf("ExportTagLibrary() error = %v", err)
	}
	if len(got.Tags) != 6 || got.Tags[0].Tag != "chochin" || got.Tags[0].Parent != "lanterns" {
		t.Errorf("Tags = %+v, want 6 sorted by ID", got.Tags)
	}
	if i := slices.IndexFunc(got.Tags, func(t TagLibraryTag) bool { return t.Tag == "lanterns" }); got.Tags[i].Photos != 1 {
		t.Errorf("lanterns = %+v, want 1 photo", got.Tags[i])
	}
	want := TagLibraryPhotoInfo{Photo: "a", Title: "Lanterns", City: "Kyoto", Country: "Japan", Notes: "for me"}
	if len(got.Photos) != 1 || got.Photos[0].Photo != want.Photo || got.Photos[0].Country != want.Country || got.Photos[0].Notes != want.Notes || !slices.Equal(got.Photos[0].Tags, []string{"lanterns"}) {
		t.Errorf("Photos = %+v, want %+v", got.Photos, want)
	}
	if p := got.Photos[0]; p.Path != photosDir+"a.json" || p.ID == nil || *p.ID != 7 {
		t.Errorf("Photos[0] path, id = %q, %v, want a.json and 7", p.Path, p.ID)
	}
	if !slices.Equal(got.Unreadable, []string{photosDir + "b.json"}) {
		t.Errorf("Unreadable = %v, want b.json", got.Unreadable)
	}
}
