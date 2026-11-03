import assert from "node:assert/strict";
import { test } from "node:test";
import { fitView, frameOf, IMAGE, parseView, pointIn, previewView } from "./view.ts";

test("reads a map link's view with the map's limits", () => {
  assert.deepEqual(parseView(new URLSearchParams("lat=37.57&lng=126.98&zoom=12.5")), {
    lat: 37.57,
    lng: 126.98,
    zoom: 12.5,
  });
  assert.equal(parseView(new URLSearchParams("lat=37.57&lng=126.98")), null);
  assert.equal(parseView(new URLSearchParams("lat=97&lng=126.98&zoom=3")), null);
  assert.equal(parseView(new URLSearchParams("lat=&lng=1&zoom=3")), null);
});

test("rounds nearby views to one", () => {
  const a = previewView({ lat: 37.566512, lng: 126.978011, zoom: 12.9 });
  const b = previewView({ lat: 37.566549, lng: 126.977989, zoom: 12.1 });
  assert.deepEqual(a, { lat: 37.5665, lng: 126.978, zoom: 12 });
  assert.deepEqual(a, b);
  assert.equal(previewView({ lat: 0, lng: 0, zoom: 22 }).zoom, 17);
});

test("puts the view's center in the middle of the image", () => {
  const frame = frameOf({ lat: 37.5665, lng: 126.978, zoom: 12 });
  const { x, y } = pointIn(frame, 126.978, 37.5665);
  assert.ok(Math.abs(x - IMAGE.width / 2) <= 0.5);
  assert.ok(Math.abs(y - IMAGE.height / 2) <= 0.5);
});

test("takes a point from the copy of the world nearest the center", () => {
  const frame = frameOf({ lat: 0, lng: 179.9, zoom: 6 });
  // Just past the date line is a little right of the middle, not a world away.
  const { x } = pointIn(frame, -179.9, 0);
  assert.ok(x > IMAGE.width / 2 && x < IMAGE.width);
});

test("fits every photo in view", () => {
  const pins: [number, number][] = [
    [-74.0, 40.7],
    [139.7, 35.7],
    [126.98, 37.57],
  ];
  const view = fitView(pins);
  const frame = frameOf(view);
  for (const [lng, lat] of pins) {
    const { x, y } = pointIn(frame, lng, lat);
    assert.ok(Math.min(x, y, IMAGE.width - x, IMAGE.height - y) > 0, `${lng},${lat} at ${x},${y}`);
  }
  assert.ok(fitView([[126.98, 37.57]]).zoom <= 14);
});
