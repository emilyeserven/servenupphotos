import assert from "node:assert/strict";
import { test } from "node:test";
import type { TripSegment } from "@/api/trip-lines";
import { ridesLine } from "@/lib/trip-hop-lines";

const spot = { latitude: 1, longitude: 2 };

test("a hop between two points, photos, the day's start or a trip stop, can name its line", () => {
  assert.equal(ridesLine({ mode: "train", photos: [1, 2] } as TripSegment), true);
  assert.equal(ridesLine({ mode: "subway", photos: [1], start: spot } as TripSegment), true);
  assert.equal(ridesLine({ mode: "train", photos: [1], end: spot } as TripSegment), true);
  assert.equal(
    ridesLine({ mode: "train", photos: [], start: spot, end: spot } as TripSegment),
    true,
  );
});

test("a hop through more points, or a walk, can't name a line", () => {
  assert.equal(ridesLine({ mode: "train", photos: [1, 2, 3] } as TripSegment), false);
  assert.equal(ridesLine({ mode: "train", photos: [1, 2], start: spot } as TripSegment), false);
  assert.equal(ridesLine({ mode: "walk", photos: [1, 2] } as TripSegment), false);
});
