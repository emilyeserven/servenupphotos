import assert from "node:assert/strict";
import { test } from "node:test";
import type { Photo } from "@portfolio/lib/photos";
import {
  currentChoice,
  dayOf,
  hasDateRange,
  matchesWhen,
  parseWhen,
  seasonSpan,
  SEASONS,
  whenCount,
} from "@portfolio/lib/when-filters";

/** A photo taken at the local time, with only what the "when" filters read. */
function takenAt(year: number, month: number, day: number, hour = 12): Photo {
  return { takenAt: new Date(year, month - 1, day, hour) } as Photo;
}

test("keeps known list values in their order and drops the rest", () => {
  assert.deepEqual(parseWhen({ month: ["march", "bogus", "january"], hour: "7" }), {
    month: ["january", "march"],
    hour: ["7"],
  });
});

test("leaves out filters that are empty or malformed", () => {
  assert.deepEqual(parseWhen({ month: [], start: "May 1", end: 5 }), {});
  assert.deepEqual(parseWhen({ start: "2026-05-01" }), { start: "2026-05-01" });
});

test("counts each kind of list and the date range once", () => {
  assert.equal(whenCount({}), 0);
  assert.equal(whenCount({ month: ["march", "april"], start: "2026-01-01", end: "2026-02-01" }), 2);
  assert.equal(hasDateRange({ end: "2026-02-01" }), true);
  assert.equal(hasDateRange({ month: ["march"] }), false);
});

test("matches a photo to any chosen value of a list", () => {
  const photo = takenAt(2026, 3, 14);
  assert.equal(matchesWhen(photo, { month: ["march", "june"] }), true);
  assert.equal(matchesWhen(photo, { month: ["june"] }), false);
  assert.equal(matchesWhen(photo, { season: ["spring"] }), true);
  assert.equal(matchesWhen(photo, { season: ["spring"], month: ["june"] }), false);
});

test("counts December, January and February as winter", () => {
  const winter = ["winter"];
  assert.equal(matchesWhen(takenAt(2026, 12, 31), { season: winter }), true);
  assert.equal(matchesWhen(takenAt(2026, 1, 1), { season: winter }), true);
  assert.equal(matchesWhen(takenAt(2026, 3, 1), { season: winter }), false);
});

test("includes both ends of a date range and treats a missing end as open", () => {
  const range = { start: "2026-05-01", end: "2026-05-31" };
  assert.equal(matchesWhen(takenAt(2026, 5, 1, 0), range), true);
  assert.equal(matchesWhen(takenAt(2026, 5, 31, 23), range), true);
  assert.equal(matchesWhen(takenAt(2026, 6, 1, 0), range), false);
  assert.equal(matchesWhen(takenAt(2030, 1, 1), { start: "2026-05-01" }), true);
  assert.equal(matchesWhen(takenAt(2020, 1, 1), { end: "2026-05-01" }), true);
});

test("matches hours and weekdays on the clock where the photo was taken", () => {
  // 2026-05-16 was a Saturday.
  const photo = takenAt(2026, 5, 16, 5);
  assert.equal(matchesWhen(photo, { hour: ["5"] }), true);
  assert.equal(matchesWhen(photo, { hour: ["6"] }), false);
  assert.equal(matchesWhen(photo, { weekday: ["saturday"] }), true);
  assert.equal(matchesWhen(photo, { weekday: ["sunday"] }), false);
});

test("writes a day with zero-padded parts", () => {
  assert.equal(dayOf(new Date(2026, 0, 5)), "2026-01-05");
});

test("finds the choice a date is in, and names a season's span", () => {
  assert.equal(currentChoice("season", new Date(2026, 10, 9)).label, "Autumn");
  assert.equal(currentChoice("month", new Date(2026, 10, 9)).value, "november");
  assert.equal(seasonSpan(SEASONS[3]!), "Dec–Feb");
});
