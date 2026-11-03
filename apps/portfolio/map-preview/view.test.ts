import assert from "node:assert/strict";
import { test } from "node:test";
import { fitView, frameOf, IMAGE, pointIn } from "../src/lib/map-preview-view.ts";

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

test("fits every photo in view, rounded for a link", () => {
  const pins: [number, number][] = [
    [-74.0, 40.7],
    [139.7, 35.7],
    [126.98, 37.57],
  ];
  const view = fitView(pins);
  assert.equal(view.zoom, Math.floor(view.zoom));
  assert.equal(view.lat, Number(view.lat.toFixed(4)));
  const frame = frameOf(view);
  for (const [lng, lat] of pins) {
    const { x, y } = pointIn(frame, lng, lat);
    assert.ok(Math.min(x, y, IMAGE.width - x, IMAGE.height - y) > 0, `${lng},${lat} at ${x},${y}`);
  }
});

test("zooms no closer than a street for one photo, and shows the world for none", () => {
  assert.equal(fitView([[126.98, 37.57]]).zoom, 14);
  assert.equal(fitView([]).zoom, 1);
});
