import assert from "node:assert/strict";
import { test } from "node:test";
import type { SocialPhoto } from "@/api/publish";
import { moveToDay, photosByDay } from "@/lib/social-schedule";

/** A calendar photo at path, published on date. */
function photo(path: string, date: string | null): SocialPhoto {
  return { path, socialMediaPublishDate: date } as unknown as SocialPhoto;
}

const a = photo("a.json", "2026-12-01");
const b = photo("b.json", "2026-12-02");
const byDay = photosByDay([a, b], {});

test("moving a photo to an empty day only moves it", () => {
  assert.deepEqual(moveToDay({}, byDay, a, "2026-12-03"), { "a.json": "2026-12-03" });
});

test("moving a photo onto another photo's day swaps them", () => {
  assert.deepEqual(moveToDay({}, byDay, a, "2026-12-02"), {
    "a.json": "2026-12-02",
    "b.json": "2026-12-01",
  });
  // An unsaved move counts as the day the photo comes from.
  assert.deepEqual(moveToDay({ "a.json": null }, byDay, a, "2026-12-02"), {
    "a.json": "2026-12-02",
    "b.json": null,
  });
});

test("taking a photo off the calendar, or dropping it on its own day, moves nothing else", () => {
  assert.deepEqual(moveToDay({}, byDay, a, null), { "a.json": null });
  assert.deepEqual(moveToDay({}, byDay, a, "2026-12-01"), { "a.json": "2026-12-01" });
});
