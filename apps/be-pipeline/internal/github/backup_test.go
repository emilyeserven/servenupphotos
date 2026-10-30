package github

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestBackupAndRestore(t *testing.T) {
	const kept = photosDir + "DSC0001.json"
	const added = photosDir + "DSC0002.json"
	f, c := newFakeGitHub(t)
	f.openPull(prBranch, map[string]string{kept: "{\n  \"file\": \"DSC0001.jpg\"\n}\n"})
	if _, err := c.Update(t.Context(), pullGH, kept, "", json.RawMessage(`{"file":"DSC0001.jpg","title":"Dusk"}`)); err != nil {
		t.Fatal(err)
	}

	backup, err := c.Backup(pullGH)
	if err != nil {
		t.Fatal(err)
	}
	if backup.Version != BackupVersion || backup.Repo != "owner/repo" || len(backup.Files) != 1 || backup.Files[0].Path != kept || !strings.Contains(string(backup.Files[0].Data), `"Dusk"`) {
		t.Fatalf("Backup() = %+v, want the one pending edit", backup)
	}

	// A fresh pipeline, as after its volume was lost, gets the edit back, plus a new file.
	f, c = newFakeGitHub(t)
	f.openPull(prBranch, map[string]string{kept: "{\n  \"file\": \"DSC0001.jpg\"\n}\n"})
	backup.Files = append(backup.Files, BackupFile{Path: added, Data: json.RawMessage(`{"file":"DSC0002.jpg"}`)})
	got, err := c.Restore(t.Context(), pullGH, backup.Files)
	if err != nil {
		t.Fatal(err)
	}
	if got.Restored != 2 || got.Unchanged != 0 {
		t.Errorf("Restore() = %+v, want 2 restored", got)
	}
	if staged, ok := stagedContent(t, c, added); !ok || staged.Content != "{\n  \"file\": \"DSC0002.jpg\"\n}\n" {
		t.Errorf("restored %q, want it formatted", staged.Content)
	}
	if w := f.writes(); len(w) != 0 {
		t.Errorf("Restore() wrote to GitHub: %v", w)
	}

	// The head's own content is nothing to restore.
	got, err = c.Restore(t.Context(), pullGH, []BackupFile{{Path: kept, Data: json.RawMessage(`{"file":"DSC0001.jpg"}`)}})
	if err != nil || got.Unchanged != 1 {
		t.Errorf("Restore(head) = %+v, %v; want it unchanged", got, err)
	}
}

func TestRestoreRefusesOtherFiles(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.openPull(prBranch, nil)
	for _, file := range []BackupFile{
		{Path: ".github/workflows/x.json", Data: json.RawMessage(`{}`)},
		{Path: photosDir + "../photos/a.json", Data: json.RawMessage(`{}`)},
		{Path: photosDir + "ALLPHOTOS.json", Data: json.RawMessage(`[]`)},
		{Path: photosDir + "a.json", Data: json.RawMessage(`{nope`)},
	} {
		if _, err := c.Restore(t.Context(), pullGH, []BackupFile{file}); err == nil {
			t.Errorf("Restore(%s) kept it, want it refused", file.Path)
		}
	}
	if _, ok := stagedContent(t, c, photosDir+"a.json"); ok {
		t.Error("a refused restore kept a file")
	}
}
