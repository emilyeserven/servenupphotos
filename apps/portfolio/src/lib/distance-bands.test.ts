import assert from "node:assert/strict";
import { test } from "node:test";
import { distanceBands } from "@portfolio/lib/distance-bands";
import { byDistance, DEFAULT_NEAR } from "@portfolio/lib/distance-sort";
import type { Photo } from "@portfolio/lib/photos";

/** A photo with only an ID and a spot, or none. */
function photo(id: number, latitude: number | null, longitude: number | null): Photo {
  return { id, latitude, longitude } as Photo;
}

const PHOTOS = [
  photo(1, 40.7128, -74.006), // New York, about 55 km
  photo(2, null, null),
  photo(3, 41.0534, -73.5387), // Stamford itself
  photo(4, 35.6762, 139.6503), // Tokyo
  photo(5, 41.0262, -73.6282), // Greenwich, about 8 km
  photo(6, 41.0535, -73.5388), // Stamford again
];

/** The groups as headings and photo IDs. */
function shape(bands: ReturnType<typeof distanceBands>) {
  return bands.map((band) => [band.label, band.photos.map((p) => p.id)]);
}

test("groups nearest first by ten times farther each, with no location last", () => {
  const sorted = byDistance(PHOTOS, "asc", DEFAULT_NEAR);
  assert.deepEqual(shape(distanceBands(sorted, DEFAULT_NEAR)), [
    ["Under 1 km", [3, 6]],
    ["1 to 10 km", [5]],
    ["10 to 100 km", [1]],
    ["1,000 km and farther", [4]],
    ["No location", [2]],
  ]);
});

test("keeps the groups in the sort's order when it's farthest first", () => {
  const sorted = byDistance(PHOTOS, "desc", DEFAULT_NEAR);
  const labels = distanceBands(sorted, DEFAULT_NEAR).map((band) => band.label);
  assert.deepEqual(labels, [
    "1,000 km and farther",
    "10 to 100 km",
    "1 to 10 km",
    "Under 1 km",
    "No location",
  ]);
});
