import assert from "node:assert/strict";
import { test } from "node:test";
import { anchorPlaces } from "@/lib/grid-anchors";
import { notStoredByDay, notStoredPath, withNotStoredDays } from "@/lib/not-stored";

const post = (day: string) => ({ id: day, day, note: "" });

test("a Not Stored day takes a place on the calendar, but a photo's day keeps its photo", () => {
  const byDay = new Map([
    ["2026-11-01", { path: "a.json" }],
    ["2026-11-03", { path: "c.json" }],
  ]);
  const notStored = notStoredByDay([post("2026-11-02"), post("2026-11-03")]);
  const days = withNotStoredDays(byDay, notStored);
  assert.deepEqual(
    [...days].toSorted(([a], [b]) => a.localeCompare(b)),
    [
      ["2026-11-01", { path: "a.json" }],
      ["2026-11-02", { path: notStoredPath("2026-11-02") }],
      ["2026-11-03", { path: "c.json" }],
    ],
  );
});

test("a Not Stored day counts toward the rows worked out from the Grid Anchor", () => {
  const byDay = new Map([
    ["2026-11-01", { path: "a.json" }],
    ["2026-11-03", { path: "c.json" }],
    ["2026-11-04", { path: "d.json" }],
  ]);
  const days = withNotStoredDays(byDay, notStoredByDay([post("2026-11-02")]));
  const places = anchorPlaces(days, "c.json", new Map());
  // a, the Not Stored day and c make the anchor's row; d starts the next.
  assert.equal(places.get("a.json")?.group, 0);
  assert.equal(places.get(notStoredPath("2026-11-02"))?.group, 0);
  assert.equal(places.get("d.json")?.group, 1);
});
