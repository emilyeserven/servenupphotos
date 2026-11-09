import assert from "node:assert/strict";
import { test } from "node:test";
import {
  exposureSeconds,
  filterWithCamera,
  parseCameraFilters,
  parseRange,
  rangeValues,
  settingNumber,
  withoutCameraFilters,
} from "@portfolio/lib/camera-filters";
import type { Photo } from "@portfolio/lib/photos";

/** A photo with the camera settings and equipment the camera filters read. */
function photo(
  id: number,
  settings: Partial<Photo["settings"]>,
  extra: Partial<Photo> = {},
): Photo {
  return {
    id,
    takenAt: new Date(2026, 4, 16),
    country: "Japan",
    state: null,
    city: "Tokyo",
    placeIds: [],
    albums: [],
    tags: [],
    genres: [],
    camera: "X100V",
    lens: null,
    settings: { iso: null, exposure: null, focalLength: null, aperture: null, ...settings },
    ...extra,
  } as Photo;
}

test("reads exposure times as seconds", () => {
  assert.equal(exposureSeconds("1/60"), 1 / 60);
  assert.equal(exposureSeconds("2.5"), 2.5);
  assert.equal(exposureSeconds(null), undefined);
  assert.equal(exposureSeconds("fast"), undefined);
});

test("compares an exposure by its length, not its text", () => {
  assert.ok(settingNumber("exposure", "1/500")! < settingNumber("exposure", "1/30")!);
  assert.equal(settingNumber("iso", 400), 400);
  assert.equal(settingNumber("iso", null), undefined);
});

test("splits a range only when it has exactly two ends", () => {
  assert.deepEqual(parseRange("100-400"), ["100", "400"]);
  assert.equal(parseRange("100"), undefined);
  assert.equal(parseRange("1-2-3"), undefined);
  assert.equal(parseRange(undefined), undefined);
});

test("lists a setting's values once each, lowest first", () => {
  const list = [
    photo(1, { exposure: "1/30" }),
    photo(2, { exposure: "1/500" }),
    photo(3, { exposure: "1/30" }),
    photo(4, { exposure: null }),
  ];
  assert.deepEqual(rangeValues(list, "exposure"), ["1/500", "1/30"]);
});

test("keeps only text camera filters that aren't empty", () => {
  assert.deepEqual(parseCameraFilters({ camera: "X100V", lens: "", iso: 100, bogus: "x" }), {
    camera: "X100V",
  });
});

test("narrows by a range, leaving out photos without the setting", () => {
  const list = [photo(1, { iso: 100 }), photo(2, { iso: 800 }), photo(3, { iso: null })];
  assert.deepEqual(
    filterWithCamera(list, { iso: "100-400" }).map((p) => p.id),
    [1],
  );
  assert.deepEqual(
    filterWithCamera(list, { iso: "100-800" }).map((p) => p.id),
    [1, 2],
  );
});

test("narrows by an exposure range written as fractions", () => {
  const list = [photo(1, { exposure: "1/1000" }), photo(2, { exposure: "1/60" })];
  assert.deepEqual(
    filterWithCamera(list, { exposure: "1/500-1/30" }).map((p) => p.id),
    [2],
  );
});

test("combines the camera name with the shared filters", () => {
  const list = [photo(1, {}), photo(2, {}, { camera: "GR III" }), photo(3, {}, { city: "Osaka" })];
  assert.deepEqual(
    filterWithCamera(list, { camera: "X100V", city: "Tokyo" }).map((p) => p.id),
    [1],
  );
});

test("matches nothing for a camera group that doesn't exist", () => {
  assert.deepEqual(filterWithCamera([photo(1, {})], { cameraGroup: "no-such-group" }), []);
});

test("leaves out the camera filters named", () => {
  const filters = withoutCameraFilters({ camera: "X100V", iso: "1-2" }, ["iso"]);
  assert.equal(filters.camera, "X100V");
  assert.equal(filters.iso, undefined);
});
