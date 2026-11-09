import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAddedDate, parseCreateDate } from "@portfolio/lib/photo-dates";

test("reads exiftool's capture time as local time", () => {
  const date = parseCreateDate("2026:05:16 15:24:10");
  assert.deepEqual(
    [date?.getFullYear(), date?.getMonth(), date?.getDate(), date?.getHours(), date?.getMinutes()],
    [2026, 4, 16, 15, 24],
  );
});

test("ignores a time zone after the capture time", () => {
  assert.equal(parseCreateDate("2026:05:16 15:24:10+09:00")?.getHours(), 15);
});

test("has no capture time for a missing or unreadable value", () => {
  assert.equal(parseCreateDate(null), null);
  assert.equal(parseCreateDate(""), null);
  assert.equal(parseCreateDate("2026-05-16 15:24:10"), null);
});

test("reads the pipeline's added date in UTC", () => {
  assert.equal(parseAddedDate("2026-10-25T04:10:22Z")?.toISOString(), "2026-10-25T04:10:22.000Z");
});

test("has no added date for a missing or invalid value", () => {
  assert.equal(parseAddedDate(undefined), null);
  assert.equal(parseAddedDate(null), null);
  assert.equal(parseAddedDate("not a date"), null);
});
