import assert from "node:assert/strict";
import { test } from "node:test";
import type { CombinedData, InFlightRead } from "@/api/photos";
import type { SocialCalendarRead } from "@/api/publish";
import {
  type CombinedView,
  allPhotosCheck,
  canonicalJson,
  entryJson,
  withBaseAllPhotos,
  withCombined,
} from "@/lib/combined";
import { GROUP_KINDS, byKind } from "@/lib/data-kinds";

test("writes equal data the same whatever its key order", () => {
  assert.equal(
    canonicalJson({ b: 1, a: { d: 2, c: 3 } }),
    canonicalJson({ a: { c: 3, d: 2 }, b: 1 }),
  );
  assert.equal(canonicalJson({ b: 1, a: 2 }), '{"a":2,"b":1}');
});

test("sorts the keys of objects inside lists, and keeps the list's order", () => {
  assert.equal(canonicalJson([{ b: 1, a: 2 }, { z: 0 }]), '[{"a":2,"b":1},{"z":0}]');
  assert.notEqual(canonicalJson([1, 2]), canonicalJson([2, 1]));
});

test("tells different data apart", () => {
  assert.notEqual(canonicalJson({ a: 1 }), canonicalJson({ a: "1" }));
  assert.notEqual(canonicalJson({ a: null }), canonicalJson({}));
});

test("writes plain values as JSON does", () => {
  assert.equal(canonicalJson(null), "null");
  assert.equal(canonicalJson("x"), '"x"');
  assert.equal(canonicalJson(undefined), undefined);
});

test("writes an entry's JSON once and reuses it for the same object", () => {
  const entry = { b: 1, a: 2 };
  assert.equal(entryJson(entry), canonicalJson(entry));
  // The lists' entries are never changed in place; this one is only to show the JSON is reused.
  entry.b = 5;
  assert.equal(entryJson(entry), '{"a":2,"b":1}');
  assert.equal(entryJson({ b: 5, a: 2 }), '{"a":2,"b":5}');
  assert.equal(entryJson(null), "null");
});

const photo = { file: "DSCF1.jpg", gpsPosition: "37, 127", createDate: "2026:10:01 09:00:00" };
const entry = { ...photo, title: "Gate" };

/** What the store has once it read ALLPHOTOS.json on the base branch with these entries. */
function readView(entries: unknown[]): CombinedView {
  const photos = {
    path: "data/ALLPHOTOS.json",
    found: true,
    fileUrl: "https://x/all",
    count: 1,
    data: entries,
  };
  return { data: { base: { branch: "main", photos } } as unknown as CombinedData };
}

test("a photo is found in ALLPHOTOS.json on the base branch by file name, GPS position and date", () => {
  const other = { ...entry, createDate: "2026:10:02 09:00:00" };
  const check = allPhotosCheck(
    { ...photo, file: " DSCF1.jpg " },
    readView([entry, other, "x"]),
    {},
  );
  assert.equal(check.path, "data/ALLPHOTOS.json");
  assert.deepEqual(check.sources, [
    { label: "main", fileUrl: "https://x/all", found: true, error: undefined },
  ]);
  assert.deepEqual(check.matches, [{ source: "main", fileUrl: "https://x/all", entry }]);
});

test("a photo's matches in the pull request come after the base branch's, each entry once", () => {
  const source = { label: "the photo data pull request", fileUrl: "https://x/pr", found: true };
  const fromPr = { source: "photos/1.json", fileUrl: "https://x/pr", entry: { ...entry } };
  const added = { source: "photos/2.json", fileUrl: "https://x/pr", entry: { file: "new.jpg" } };
  const check = allPhotosCheck(photo, readView([entry]), {
    check: { sources: [source], matches: [fromPr, added] },
  });
  assert.equal(check.sources[1], source);
  assert.deepEqual(
    check.matches.map((m) => m.source),
    ["main", "photos/2.json"],
  );
});

test("a check the store or the backend couldn't run says why in its sources", () => {
  const check = allPhotosCheck(photo, { error: new Error("offline") }, { error: new Error("502") });
  assert.equal(check.path, "ALLPHOTOS.json");
  assert.deepEqual(check.sources, [
    { label: "the base branch", fileUrl: "", found: true, error: "offline" },
    { label: "the photo data pull request", fileUrl: "", found: true, error: "502" },
  ]);
  assert.deepEqual(check.matches, []);
  assert.deepEqual(allPhotosCheck(photo, {}, {}).sources, [
    { label: "the base branch", fileUrl: "", found: true, error: undefined },
  ]);
});

test("the calendar's photos are marked in flight from ALLPHOTOS.json on the base branch", () => {
  const read = { folder: "data", photos: [photo, { ...photo, file: "DSCF2.jpg" }] };
  const calendar = withBaseAllPhotos(read as unknown as SocialCalendarRead, readView([entry]));
  assert.equal(calendar.allPhotos.path, "data/ALLPHOTOS.json");
  assert.deepEqual(
    calendar.photos.map((p) => p.inAllPhotos),
    [true, false],
  );
});

test("the calendar says when ALLPHOTOS.json isn't read yet or couldn't be", () => {
  const read = { folder: "data", photos: [photo] } as unknown as SocialCalendarRead;
  assert.equal(withBaseAllPhotos(read, {}).allPhotos.error, "Still reading it.");
  assert.equal(
    withBaseAllPhotos(read, { error: new Error("offline") }).allPhotos.error,
    "Couldn't read it: offline",
  );
});

/** The pull request's files as the backend reads them: one photo file and one album file. */
function inFlight(pullRequest: boolean): InFlightRead {
  const groups = byKind(GROUP_KINDS, () => ({ files: [] as { data?: unknown }[] }));
  groups.albums.files = [{ data: { id: "japan" } }];
  return {
    folder: "data/photos",
    ...(pullRequest && { pullRequest: { number: 7 } }),
    files: [{ data: entry }, { data: { file: "new.jpg" } }, {}],
    ...groups,
  } as unknown as InFlightRead;
}

test("the pull request's files are checked against the combined lists at its head", () => {
  const all = (data: unknown[]) => ({ path: "x", found: true, count: data.length, data });
  const head = {
    ...byKind(GROUP_KINDS, () => all([])),
    photos: all([entry]),
    albums: all([{ id: "japan" }]),
  };
  const view = { data: { head } as unknown as CombinedData };
  const checked = withCombined(inFlight(true), view);
  assert.deepEqual(
    checked.files.map((f) => f.inAllPhotos),
    [true, false, null],
  );
  assert.deepEqual(
    checked.albums.files.map((f) => f.inAll),
    [true],
  );
});

test("with no pull request, or before the lists are read, the files aren't checked", () => {
  const view = { data: { head: null } as unknown as CombinedData };
  const none = withCombined(inFlight(false), view);
  assert.deepEqual(none.allPhotos, { path: "data/photos/ALLPHOTOS.json", found: false, count: 0 });
  assert.deepEqual(none.albums.all, { path: "data/albums/ALLALBUMS.json", found: false, count: 0 });
  assert.deepEqual(
    none.files.map((f) => f.inAllPhotos),
    [null, null, null],
  );
  assert.equal(withCombined(inFlight(true), {}).allPhotos.error, "Still reading it.");
});
