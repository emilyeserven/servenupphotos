import assert from "node:assert/strict";
import { test } from "node:test";
import type { CombinedData } from "@/api/photos";
import { GROUP_KINDS, byKind } from "@/lib/data-kinds";
import { type FileChange, pendingText, summarizeChanges, withChanges } from "@/lib/optimistic";

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

/** A combined file listing these entries; one that couldn't be read without them. */
function listed(data?: unknown[]) {
  return { path: "x", found: true, count: data?.length ?? 0, ...(data && { data }) };
}

/** The combined lists with these albums on the base branch and no pull request open. */
function baseOnly(albums: unknown[]): CombinedData {
  const base = {
    branch: "main",
    ...byKind(GROUP_KINDS, () => listed([])),
    photos: listed([]),
    albums: listed(albums),
  };
  return { base, head: null } as unknown as CombinedData;
}

const japan = { id: "japan", name: "Japan" };
const korea = { id: "korea", name: "Korea" };

/** The albums at the head once changes are made over baseOnly(albums). */
function albumsAfter(albums: unknown[], changes: Omit<FileChange, "kind" | "path">[]) {
  const data = withChanges(
    baseOnly(albums),
    changes.map((c) => ({ kind: "albums", path: "a.json", ...c })),
  );
  return data.head?.albums;
}

test("a change replaces its old entry, ignoring key order, or adds the new one at the end", () => {
  assert.deepEqual(
    albumsAfter(
      [japan, korea],
      [{ before: { name: "Japan", id: "japan" }, after: { ...japan, name: "日本" } }],
    )?.data,
    [{ ...japan, name: "日本" }, korea],
  );
  assert.deepEqual(albumsAfter([japan], [{ after: korea }]), listed([japan, korea]));
  assert.deepEqual(albumsAfter([japan], [{ before: { id: "gone" }, after: korea }])?.data, [
    japan,
    korea,
  ]);
});

test("a change that removed a file takes its entry out, and one never listed changes nothing", () => {
  assert.deepEqual(albumsAfter([japan, korea], [{ before: japan, after: null }]), listed([korea]));
  assert.deepEqual(albumsAfter([japan], [{ before: korea, after: null }])?.data, [japan]);
  assert.deepEqual(albumsAfter([japan], [{ after: null }])?.data, [japan]);
});

test("with no pull request open the changes go over the base branch's lists, which stay as they are", () => {
  const data = baseOnly([japan]);
  const changed = withChanges(data, [{ kind: "albums", path: "a.json", after: korea }]);
  assert.equal(changed.head?.pullRequest.number, 0);
  assert.deepEqual(changed.base.albums.data, [japan]);
  assert.equal(withChanges(data, []), data);
});
