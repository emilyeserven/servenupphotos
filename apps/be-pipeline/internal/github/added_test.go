package github

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestStampAdded(t *testing.T) {
	now := time.Date(2026, 10, 25, 13, 10, 22, 0, time.FixedZone("JST", 9*60*60))
	tests := []struct {
		name, content, want string
		includeUntitled     bool
	}{
		{"given a title", `{"title":"Tokyo","addedDate":null}`, `{"title":"Tokyo","addedDate":"2026-10-25T04:10:22Z"}`, false},
		{"still a draft", `{"title":" ","addedDate":null}`, `{"title":" ","addedDate":null}`, false},
		{"untitled photos included", `{"title":null,"addedDate":null}`, `{"title":null,"addedDate":"2026-10-25T04:10:22Z"}`, true},
		{"already added", `{"title":"Tokyo","addedDate":"2024-01-02T03:04:05Z"}`, `{"title":"Tokyo","addedDate":"2024-01-02T03:04:05Z"}`, false},
		{"older file, left for Missing fields", `{"title":"Tokyo"}`, `{"title":"Tokyo"}`, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := &workspace{includeUntitled: tt.includeUntitled}
			if got := string(w.stampAdded([]byte(tt.content), now)); got != tt.want {
				t.Errorf("stampAdded() = %s, want %s", got, tt.want)
			}
		})
	}
}

func TestPublishLeavesADraftUndated(t *testing.T) {
	repo := &baseURLRepo{files: map[string]string{}}
	got, err := repo.start(t).Publish(t.Context(), baseURLSettings, Photo{Name: "D", File: "D.jpg"})
	if err != nil {
		t.Fatalf("Publish() error = %v", err)
	}
	if !strings.Contains(string(got.Data), `"addedDate": null`) {
		t.Errorf("Publish() data = %s, want a null addedDate", got.Data)
	}
}

func TestUpdateDatesADraftGivenATitle(t *testing.T) {
	const file = photosDir + "DSC0001.json"
	f, c := newFakeGitHub(t)
	f.openPull(prBranch, map[string]string{file: "{\n  \"title\": null,\n  \"addedDate\": null\n}\n"})
	got, err := c.Update(t.Context(), pullGH, file, "", json.RawMessage(`{"title":"Tokyo","addedDate":null}`))
	if err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	want := "{\n  \"title\": \"Tokyo\",\n  \"addedDate\": \"2026-10-15T02:45:00Z\"\n}\n"
	if string(got.Data) != want {
		t.Errorf("Update() data = %s, want %s", got.Data, want)
	}
	if staged, _ := stagedContent(t, c, file); staged.Content != want {
		t.Errorf("pending %q, want %q", staged.Content, want)
	}
}

func TestBackfillDatesPhotosByTheirFirstCommit(t *testing.T) {
	repo := &baseURLRepo{pull: true, files: map[string]string{
		"A.json": `{"title":"Tokyo","file":"A.jpg"}`,
		"B.json": `{"title":null,"file":"B.jpg"}`,
		"C.json": `{"title":"Kyoto","addedDate":"2025-05-05T05:05:05Z","file":"C.jpg"}`,
	}}
	c := repo.start(t)
	repo.f.created[photosDir+"A.json"] = "2024-03-01T10:00:00Z"
	repo.f.created[photosDir+"B.json"] = "2023-01-01T10:00:00Z"
	repo.f.created[photosDir+"C.json"] = "2022-01-01T10:00:00Z"

	preview, err := c.PreviewBackfill(t.Context(), baseURLSettings, Readers{})
	if err != nil {
		t.Fatalf("PreviewBackfill() error = %v", err)
	}
	dates := map[string]AddedField{}
	for _, f := range preview.Files {
		for _, a := range f.Added {
			if a.Field == addedField {
				dates[strings.TrimPrefix(f.Path, photosDir)] = a
			}
		}
	}
	if a := dates["A.json"]; string(a.Value) != `"2024-03-01T10:00:00Z"` || !a.FromHistory {
		t.Errorf("A.json addedDate = %+v, want its first commit's time", a)
	}
	if b := dates["B.json"]; string(b.Value) != "null" || b.FromHistory {
		t.Errorf("B.json addedDate = %+v, want null, as it's a draft", b)
	}
	if _, ok := dates["C.json"]; ok {
		t.Error("C.json was dated, but it has a date")
	}
	for _, field := range preview.Fields {
		if field.Field == addedField && (field.Files != 2 || field.FromHistory != 1) {
			t.Errorf("addedDate count = %+v, want 2 files, 1 from history", field)
		}
	}
}
