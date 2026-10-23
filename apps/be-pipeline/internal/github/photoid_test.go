package github

import (
	"strings"
	"testing"
	"time"
)

func TestBackfillNumbersPhotosInCreationOrder(t *testing.T) {
	repo := &baseURLRepo{pull: true, files: map[string]string{
		"A.json": `{"file":"A.jpg"}`,
		"B.json": `{"file":"B.jpg"}`,
		"C.json": `{"id":5,"file":"C.jpg"}`,
		// Created in the same commit as B, so it comes after it by name.
		"E.json": `{"file":"E.jpg"}`,
	}}
	c := repo.start(t)
	repo.f.created[photosDir+"A.json"] = "2024-03-01T10:00:00Z"
	repo.f.created[photosDir+"B.json"] = "2023-01-01T10:00:00Z"
	repo.f.created[photosDir+"C.json"] = "2022-01-01T10:00:00Z"
	repo.f.created[photosDir+"E.json"] = "2023-01-01T10:00:00Z"
	// D is only in the pending changes, saved after every committed file.
	err := c.stage().update(target{owner: "owner", name: "repo"}, func(files map[string]StagedFile) {
		files[photosDir+"D.json"] = StagedFile{
			Content: `{"file":"D.jpg"}`, Saved: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
		}
	})
	if err != nil {
		t.Fatal(err)
	}

	preview, err := c.PreviewBackfill(t.Context(), baseURLSettings, Readers{})
	if err != nil {
		t.Fatalf("PreviewBackfill() error = %v", err)
	}
	ids := map[string]string{}
	for _, f := range preview.Files {
		for _, a := range f.Added {
			if a.Field == idField && a.Numbered {
				ids[strings.TrimPrefix(f.Path, photosDir)] = string(a.Value)
			}
		}
	}
	want := map[string]string{"B.json": "6", "E.json": "7", "A.json": "8", "D.json": "9"}
	for name, id := range want {
		if ids[name] != id {
			t.Errorf("%s id = %q, want %s (ids %v)", name, ids[name], id, ids)
		}
	}
	if _, ok := ids["C.json"]; ok {
		t.Error("C.json was given an id, but it has one")
	}

	if _, err := c.Backfill(t.Context(), baseURLSettings, Readers{}); err != nil {
		t.Fatalf("Backfill() error = %v", err)
	}
	if got := repo.staged(t)[photosDir+"A.json"]; !strings.HasPrefix(got, `{"id":8,"title"`) {
		t.Errorf("A.json = %s, want id 8 first", got)
	}
}

func TestPublishGivesTheNextID(t *testing.T) {
	repo := &baseURLRepo{files: map[string]string{"C.json": `{"id":41,"file":"C.jpg"}`}}
	c := repo.start(t)
	got, err := c.Publish(t.Context(), baseURLSettings, Photo{Name: "D", File: "D.jpg"})
	if err != nil {
		t.Fatalf("Publish() error = %v", err)
	}
	if id, ok := photoID(got.Data); !ok || id != 42 {
		t.Errorf("Publish() id = %d, want 42", id)
	}
}
