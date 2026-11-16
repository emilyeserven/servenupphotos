import assert from "node:assert/strict";
import { test } from "node:test";
import { formatCoordinates } from "@portfolio/lib/map-coordinates";

test("gives latitude first, then longitude, with six decimals", () => {
  assert.equal(formatCoordinates({ lat: 35.6812362, lng: 139.7671248 }), "35.681236, 139.767125");
});

test("keeps the signs south and west", () => {
  assert.equal(formatCoordinates({ lat: -33.8568, lng: -151.2153 }), "-33.856800, -151.215300");
});

test("brings a longitude past the date line back between -180 and 180", () => {
  assert.equal(formatCoordinates({ lat: 0, lng: 190 }), "0.000000, -170.000000");
  assert.equal(formatCoordinates({ lat: 0, lng: -540 }), "0.000000, -180.000000");
});
