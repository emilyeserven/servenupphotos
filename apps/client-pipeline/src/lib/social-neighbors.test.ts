import assert from "node:assert/strict";
import { test } from "node:test";
import type { SocialPhoto } from "@/api/publish";
import { neighborsFor, takenAt } from "@/lib/social-neighbors";

/** A photo named file, taken at createDate, on the calendar on date. */
function photo(file: string, createDate: string, date: string | null = null): SocialPhoto {
  return {
    path: `photos/${file}.json`,
    file,
    data: createDate ? { createDate } : {},
    socialMediaPublishDate: date,
    inAllPhotos: true,
  } as unknown as SocialPhoto;
}

const all = () => true;
const names = (result: ReturnType<typeof neighborsFor>) =>
  result?.photos.map(({ photo, offset }) => `${photo.file}${offset}`);

/** Photos a to j taken a day apart, with e on the calendar on 2026-11-01. */
const roll = "abcdefghij"
  .split("")
  .map((file, i) => photo(file, `2026:01:1${i} 10:00:00`, file === "e" ? "2026-11-01" : null));

test("reads custom and EXIF dates as sortable text", () => {
  assert.equal(takenAt({ createDate: "2026:01:02 03:04:05" }), "2026-01-02 03:04:05");
  assert.equal(takenAt({ createDate: "2026-01-02T03:04" }), "2026-01-02 03:04:00");
  assert.equal(
    takenAt({ createDate: "2026:01:02", customCreateDate: "2025-12-31" }),
    "2025-12-31 00:00:00",
  );
  assert.equal(takenAt({}), "");
});

test("suggests the 3 photos taken before and the 5 after the last scheduled one", () => {
  const result = neighborsFor(roll, {}, "2026-11-02", new Map(), all);
  assert.equal(result?.anchor.file, "e");
  assert.equal(result?.anchorDay, "2026-11-01");
  assert.deepEqual(names(result), ["b-3", "c-2", "d-1", "f1", "g2", "h3", "i4", "j5"]);
});

test("uses the last photo on the calendar before the day, with unsaved dates", () => {
  const unsaved = { "photos/b.json": "2026-11-05", "photos/h.json": "2026-11-20" };
  assert.equal(neighborsFor(roll, unsaved, "2026-11-10", new Map(), all)?.anchor.file, "b");
  assert.equal(neighborsFor(roll, unsaved, "2026-11-21", new Map(), all)?.anchor.file, "h");
  assert.equal(neighborsFor(roll, unsaved, "2026-11-01", new Map(), all), null);
});

test("skips photos the Focus leaves out and ones without a date", () => {
  const photos = [...roll, photo("undated", "")];
  const allowed = (p: SocialPhoto) => p.file !== "d" && p.file !== "g";
  assert.deepEqual(names(neighborsFor(photos, {}, "2026-11-02", new Map(), allowed)), [
    "a-3",
    "b-2",
    "c-1",
    "f1",
    "h2",
    "i3",
    "j4",
  ]);
});

test("orders by changes waiting for Commit", () => {
  const changed = new Map([["photos/j.json", { createDate: "2026:01:14 12:00:00" }]]);
  assert.deepEqual(names(neighborsFor(roll, {}, "2026-11-02", changed, all)), [
    "b-3",
    "c-2",
    "d-1",
    "j1",
    "f2",
    "g3",
    "h4",
    "i5",
  ]);
});
