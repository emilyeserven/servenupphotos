import assert from "node:assert/strict";
import { test } from "node:test";
import { gpsText, photoGps, photoPosition } from "@portfolio/lib/photo-gps";
import type { PhotoEntry } from "@portfolio/lib/photos";

/** A photo with only the GPS fields. */
function entry(fields: Record<string, unknown>): PhotoEntry {
  return { gpsPosition: null, ...fields } as PhotoEntry;
}

const SEOUL = `37 deg 31' 21.06" N, 126 deg 58' 46.24" E`;

test("reads exiftool's degrees, minutes and seconds", () => {
  const { latitude, longitude } = photoGps(entry({ gpsPosition: SEOUL }));
  assert.ok(Math.abs(latitude! - 37.52252) < 1e-5);
  assert.ok(Math.abs(longitude! - 126.97951) < 1e-5);
});

test("makes southern and western positions negative", () => {
  const { latitude, longitude } = photoGps(
    entry({ gpsPosition: `33 deg 51' 0.00" S, 151 deg 12' 0.00" W` }),
  );
  assert.equal(latitude, -(33 + 51 / 60));
  assert.equal(longitude, -(151 + 12 / 60));
});

test("reads a custom decimal position and prefers it to the EXIF one", () => {
  const position = photoGps(entry({ gpsPosition: SEOUL, customGpsPosition: "40.7795, -73.9634" }));
  assert.deepEqual(position, { latitude: 40.7795, longitude: -73.9634 });
});

test("falls back to the EXIF position when the custom one can't be read", () => {
  const position = photoGps(entry({ gpsPosition: SEOUL, customGpsPosition: "somewhere" }));
  assert.ok(Math.abs(position.latitude! - 37.52252) < 1e-5);
});

test("has no position when neither can be read, or only half is there", () => {
  const none = { latitude: null, longitude: null };
  assert.deepEqual(photoGps(entry({})), none);
  assert.deepEqual(photoGps(entry({ gpsPosition: "40.7" })), none);
  assert.deepEqual(photoGps(entry({ gpsPosition: "abc, 12" })), none);
});

test("puts a photo with its own position at that position, exactly", () => {
  const position = photoPosition(entry({ customGpsPosition: "10, 20" }));
  assert.deepEqual(position, { latitude: 10, longitude: 20, approximatePosition: false });
});

test("has no position for a photo with no GPS and no known place", () => {
  const position = photoPosition(entry({ places: [{ id: "no-such-place" }] }));
  assert.deepEqual(position, { latitude: null, longitude: null, approximatePosition: false });
});

test("writes a position as degrees, minutes and seconds", () => {
  assert.equal(gpsText({ latitude: 37.52252, longitude: 126.97951 }), "37°31′21″ N, 126°58′46″ E");
  assert.equal(gpsText({ latitude: -33.85, longitude: -151.2 }), "33°51′0″ S, 151°12′0″ W");
});

test("writes no text without both parts", () => {
  assert.equal(gpsText({ latitude: 1, longitude: null }), null);
});
