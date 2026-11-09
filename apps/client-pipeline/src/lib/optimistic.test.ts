import assert from "node:assert/strict";
import { test } from "node:test";
import { type FileChange, pendingText, summarizeChanges } from "@/lib/optimistic";

const photoAdded: FileChange = { kind: "photos", path: "a.json", after: { title: "A" } };
const photoEdited: FileChange = {
  kind: "photos",
  path: "b.json",
  before: { title: "B" },
  after: { title: "B2" },
};

test("counts nothing for no changes", () => {
  const summary = summarizeChanges([], 0);
  assert.equal(pendingText(summary), "");
  assert.deepEqual(summary.images, { added: 0, modified: 0, deleted: 0 });
});

test("counts a file added, one modified, and one deleted", () => {
  const deleted: FileChange = { kind: "photos", path: "c.json", before: {}, after: null };
  const { images } = summarizeChanges([photoAdded, photoEdited, deleted], 0);
  assert.deepEqual(images, { added: 1, modified: 1, deleted: 1 });
});

test("counts a file changed twice once, by its first and last change", () => {
  const again: FileChange = { ...photoAdded, after: { title: "A2" }, before: { title: "A" } };
  assert.deepEqual(summarizeChanges([photoAdded, again], 0).images, {
    added: 1,
    modified: 0,
    deleted: 0,
  });
});

test("counts a file added and then deleted as no change", () => {
  const removed: FileChange = { ...photoAdded, before: photoAdded.after, after: null };
  assert.deepEqual(summarizeChanges([photoAdded, removed], 0).images, {
    added: 0,
    modified: 0,
    deleted: 0,
  });
});

test("counts the other kinds by name, apart from images", () => {
  const album: FileChange = { kind: "albums", path: "x.json", after: {} };
  const summary = summarizeChanges([album, photoAdded], 0);
  assert.equal(summary.albums, 1);
  assert.equal(summary.images.added, 1);
});

test("adds the files GitHub listed as changed when the app started", () => {
  const summary = summarizeChanges([], 0, [
    { kind: "photos", path: "x.json", change: "added" },
    { kind: "tags", path: "t.json", change: "modified" },
  ]);
  assert.equal(summary.images.added, 1);
  assert.equal(summary.tags, 1);
});

test("lets GitHub say a file the app changed again was added before", () => {
  const checked = [{ kind: "photos" as const, path: "b.json", change: "added" as const }];
  const summary = summarizeChanges([photoEdited], 0, checked);
  assert.deepEqual(summary.images, { added: 1, modified: 0, deleted: 0 });
});

test("counts a file GitHub listed as added and the app then deleted as no change", () => {
  const checked = [{ kind: "photos" as const, path: "b.json", change: "added" as const }];
  const deleted: FileChange = { ...photoEdited, after: null };
  assert.equal(pendingText(summarizeChanges([deleted], 0, checked)), "");
});

test("says what's waiting, with plurals and in a fixed order", () => {
  const album: FileChange = { kind: "albums", path: "x.json", after: {} };
  const text = pendingText(summarizeChanges([photoAdded, photoEdited, album], 2));
  assert.equal(text, "2 images, 1 album, 2 other saves");
});

test("says one image, not images", () => {
  assert.equal(pendingText(summarizeChanges([photoAdded], 0)), "1 image");
});
