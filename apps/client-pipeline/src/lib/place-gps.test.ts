import assert from "node:assert/strict";
import { test } from "node:test";
import { decimalGps, gpsText, parseGps, writtenPosition } from "@/lib/place-gps";

test("a GPS position copied from Google Maps reads as decimal degrees", () => {
  assert.deepEqual(parseGps("37.5796, 126.977"), { latitude: 37.5796, longitude: 126.977 });
  assert.deepEqual(parseGps("-33.86,151.21"), { latitude: -33.86, longitude: 151.21 });
});

test("a GPS position in degrees, minutes and seconds reads in either order, south and west negative", () => {
  assert.deepEqual(parseGps("37°34′12″N 126°59′56″E"), {
    latitude: 37.57,
    longitude: 126.998889,
  });
  assert.deepEqual(parseGps("126 deg 59' 56.00\" E, 37 deg 34' 12.00\" N"), {
    latitude: 37.57,
    longitude: 126.998889,
  });
  assert.deepEqual(parseGps("33°52′S 151°12′E"), { latitude: -33.866667, longitude: 151.2 });
  assert.deepEqual(parseGps("40°N 74°W"), { latitude: 40, longitude: -74 });
});

test("empty text has no coordinates, and text that isn't a position can't be read", () => {
  assert.deepEqual(parseGps("  "), {});
  assert.equal(parseGps("Seoul"), null);
  assert.equal(parseGps("37.5"), null);
  assert.equal(parseGps("95, 10"), null);
  assert.equal(parseGps("10, 190"), null);
  // Two latitudes, or a position with other words around it, aren't a position.
  assert.equal(parseGps("37°N 38°N"), null);
  assert.equal(parseGps("near 37°N 126°E"), null);
  assert.equal(parseGps("37°N 126°E 10°N"), null);
  // A position written in degrees but off the globe isn't one either.
  assert.equal(parseGps("95°N 126°E"), null);
});

test("a position in degrees, minutes and seconds is rewritten in decimal degrees; other text stays", () => {
  assert.equal(decimalGps("40°N 74°30′W"), "40, -74.5");
  assert.equal(decimalGps("37.5, 127"), "37.5, 127");
  assert.equal(decimalGps("Seoul"), "Seoul");
});

test("a written position needs both parts", () => {
  assert.deepEqual(writtenPosition("37.5, 127"), { latitude: 37.5, longitude: 127 });
  assert.equal(writtenPosition(""), null);
  assert.equal(writtenPosition(undefined), null);
  assert.equal(writtenPosition("Seoul"), null);
});

test("a place's GPS position is written as latitude, longitude, or not at all", () => {
  assert.equal(gpsText({ latitude: 37.5, longitude: 127 }), "37.5, 127");
  assert.equal(gpsText({ latitude: 37.5 }), "");
  assert.equal(gpsText({}), "");
});
