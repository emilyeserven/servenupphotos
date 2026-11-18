import assert from "node:assert/strict";
import { test } from "node:test";
import { distanceKm } from "@portfolio/lib/distance";
import {
  byDistance,
  DEFAULT_NEAR,
  distanceText,
  nearLabel,
  photoDistanceText,
  nearPoint,
  parseNear,
  parsePoint,
  pointText,
} from "@portfolio/lib/distance-sort";
import type { Photo } from "@portfolio/lib/photos";

/** A photo with only an ID and a spot, or none. */
function photo(id: number, latitude: number | null, longitude: number | null): Photo {
  return { id, latitude, longitude } as Photo;
}

const NEW_YORK = photo(1, 40.7128, -74.006);
const NO_GPS = photo(2, null, null);
const GREENWICH = photo(3, 41.0262, -73.6282);
const TOKYO = photo(4, 35.6762, 139.6503);
const NO_GPS_OLDER = photo(5, null, null);
const NEWEST_FIRST = [NEW_YORK, NO_GPS, GREENWICH, TOKYO, NO_GPS_OLDER];

test("measures about 5,570 km from New York to London", () => {
  const km = distanceKm(
    { latitude: 40.7128, longitude: -74.006 },
    { latitude: 51.5074, longitude: -0.1278 },
  );
  assert.ok(Math.abs(km - 5570) < 10);
});

test("sorts nearest to Stamford first, with photos without GPS last, newest first", () => {
  const ids = byDistance(NEWEST_FIRST, "asc", DEFAULT_NEAR).map((p) => p.id);
  assert.deepEqual(ids, [3, 1, 4, 2, 5]);
});

test("turned around, sorts farthest first and still leaves photos without GPS last", () => {
  const ids = byDistance(NEWEST_FIRST, "desc", DEFAULT_NEAR).map((p) => p.id);
  assert.deepEqual(ids, [4, 1, 3, 2, 5]);
});

test("keeps photos at the same spot newest first", () => {
  const twin = photo(9, 41.0262, -73.6282);
  const ids = byDistance([twin, GREENWICH], "asc", DEFAULT_NEAR).map((p) => p.id);
  assert.deepEqual(ids, [9, 3]);
});

test("reads a spot from the URL and writes it back to 4 places", () => {
  assert.deepEqual(parsePoint("41.0534, -73.5387"), { latitude: 41.0534, longitude: -73.5387 });
  assert.equal(parsePoint("91,0"), undefined);
  assert.equal(parsePoint("somewhere"), undefined);
  assert.equal(pointText({ latitude: 41.053412, longitude: -73.53871 }), "41.0534,-73.5387");
});

test("keeps only a spot or a Places value as ?near=", () => {
  assert.deepEqual(parseNear("41.05,-73.54"), { near: "41.05,-73.54" });
  assert.deepEqual(parseNear("city:Stamford"), { near: "city:Stamford" });
  assert.deepEqual(parseNear("album:trips"), {});
  assert.deepEqual(parseNear("place:"), {});
  assert.deepEqual(parseNear(3), {});
});

test("measures from Stamford when the URL doesn't say, or nothing there has a position", () => {
  assert.deepEqual(nearPoint(undefined, NEWEST_FIRST), DEFAULT_NEAR);
  assert.deepEqual(nearPoint("country:Nowhere", NEWEST_FIRST), DEFAULT_NEAR);
  assert.deepEqual(nearPoint("1.5,2.5", NEWEST_FIRST), { latitude: 1.5, longitude: 2.5 });
});

test("names Stamford, a spot, or the chosen place", () => {
  const tree = [
    {
      key: "country",
      value: "United States",
      label: { english: "United States" },
      children: [{ key: "city", value: "Stamford", label: { english: "Stamford" }, children: [] }],
    },
  ] as unknown as Parameters<typeof nearLabel>[1];
  assert.equal(nearLabel(undefined, tree), "Stamford, CT");
  assert.equal(nearLabel("41.0534,-73.5387", tree), "41.05, -73.54");
  assert.equal(nearLabel("city:Stamford", tree), "Stamford");
  assert.equal(nearLabel("place:gone", tree), "gone");
});

test("writes a distance in meters, then km to one place, then whole km", () => {
  assert.equal(distanceText(0.3504), "350 m");
  assert.equal(distanceText(4.24), "4.2 km");
  assert.equal(distanceText(1234.4), "1,234 km");
});

test("has no distance for a photo the map can't place", () => {
  assert.equal(photoDistanceText(NO_GPS, DEFAULT_NEAR), undefined);
  assert.equal(photoDistanceText(GREENWICH, DEFAULT_NEAR), "8.1 km");
});
