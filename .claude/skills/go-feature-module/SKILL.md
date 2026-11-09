---
name: go-feature-module
description: Use when adding or changing logic in apps/be-pipeline/internal/github, so reads see the workspace, saves go to the stage and tests use the package's fake GitHub.
---

# A feature module in `internal/github`

Everything that reads or commits photo data to GitHub lives in `apps/be-pipeline/internal/github`, one file per
feature (`tagfavorites.go`, `graphpresets.go`, …) with a `_test.go` next to it. Read `docs/pending-changes.md` and
`docs/saving-to-github.md` first, then the feature's own `docs/<feature>.md`.

## How a read sees the data

A method starts with `w, perr := c.workspace(ctx, gh)` (`workspace.go`). The `workspace` is the photo data **as the
next Commit will commit it**:

- `state.go`: where the repository stands (the base branch's head and the open **Add photo data** pull request), one
  GraphQL query per run.
- `snapshot.go`: every data file at one commit, read from GitHub once and kept, since a commit never changes.
  `w.base` is the base branch's head and `w.head` the pull request's head (or `base` when none is open).
- `stage.go`: the changes waiting for Commit (`Stage`, `StagedFile`), laid over `head` as `w.staged`.
- `localcopy.go`: `LocalCopy` keeps the state and snapshots on disk, so the pipeline works from them when GitHub
  can't be reached.

Use the workspace's helpers rather than reading GitHub: `w.file(p)`, `w.paths(folder, skip)`, `w.changed(...)`,
`w.status(p)`, `w.onBase(p)`, `w.isPending(p)` and `w.groups()`.

## How a save goes

- [ ] A save never calls GitHub. Build a `map[string][]byte` (nil content deletes) and call `c.save(w, changes)`, or
      `c.saveFiles(w, []ScanChange)` to answer with the before and after `ScanChange`s the app lays over its lists.
      Saving a file back to what the head has drops its change.
- [ ] Only `CommitCombined` (`commitcombined.go`) writes to GitHub: one commit with every staged file and the combined
      files rebuilt. Don't add another writer.
- [ ] A new photo JSON field goes in `newPhotoJSON` (`publish.go`), plus `backfill_fields_test.go` and
      `testdata/backfill/filled.json`.

## Errors

- Return a `*PublishError` (`publish.go`): `publishErr(status, "a message the user can read: %v", err)`. Use
  `http.StatusBadRequest` for bad input, `StatusNotFound` for an unknown ID, `StatusConflict` for a taken name and
  `StatusInternalServerError` when the stage or a read fails. A failed GitHub call carries GitHub's answer in
  `PublishError.GitHub` (`Failure` in `failure.go`); the HTTP handler turns it into `writeError`.
- An exported method returns `error`; callers and tests use `errors.As(err, &perr)`.

## Tests

The package's fake is `fakeGitHub` in `fake_test.go`: an in-memory owner/repo whose `files` map is
`"branch:path" → content`, with `openPull(branch, files)`, `fail` (a call key → status), `writes()` and `count(key)`.
There is no `newFakeRepo` or `fakeBucket` in this package; the R2 fakes are in `internal/httpapi`'s tests. Settings
values to reuse: `organizeGH` (`organize_test.go`, with `Folder: "data"`), `pullGH` and `gh`.

```go
func TestSetThing(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.files["main:data/tags/night.json"] = `{"id":"night","name":"night"}`

	got, err := c.SetThing(t.Context(), organizeGH, "night")
	if err != nil {
		t.Fatalf("SetThing() error = %v", err)
	}
	// Check got.Changes[0].After here, then that the save stayed in the stage:
	if w := f.writes(); len(w) != 0 {
		t.Errorf("SetThing() wrote to GitHub: %v", w)
	}
	var perr *PublishError
	if _, err = c.SetThing(t.Context(), organizeGH, "missing"); !errors.As(err, &perr) || perr.Status != http.StatusNotFound {
		t.Errorf("SetThing(missing) error = %v, want not found", err)
	}
}
```

## Finish

- [ ] A doc comment on every exported function, type and field, in plain sentences and the user's words ("the photo
      data pull request", "Square Thumbnail"), with a "Frontend analogy:" line where the idea is backend-only.
- [ ] `cd apps/be-pipeline && go test ./internal/github/` and `golangci-lint run` (CI pins v2.14.0).
- [ ] Then the handler in `internal/httpapi/<area>.go` and its line in `routes_<area>.go`,
      `apps/client-pipeline/src/api/<area>.ts`, a fixture in `scripts/screenshot-fixtures.mjs`, and `docs/<feature>.md`.
