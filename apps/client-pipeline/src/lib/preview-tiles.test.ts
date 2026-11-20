import assert from "node:assert/strict";
import { test } from "node:test";
import { previewBox } from "@/lib/preview-tiles";

const points: [number, number][] = [
  [132.75, 35.36],
  [133.06, 35.46],
];

test("fits the points inside the box, centered, north up", () => {
  const { at } = previewBox(points, [240, 120, 10], { dark: false, key: "k" });
  const [a, b] = points.map(([lng, lat]) => at(lng, lat));
  for (const [x, y] of [a!, b!]) {
    assert.ok(x >= 9.99 && x <= 230.01 && y >= 9.99 && y <= 110.01, `${x}, ${y} out of the box`);
  }
  assert.ok(b![1] < a![1], "the northern point is higher");
  assert.ok(Math.abs((a![0] + b![0]) / 2 - 120) < 0.01, "centered across");
});

test("covers the whole box with tiles at the zoom just above the fit", () => {
  const { tiles } = previewBox(points, [240, 120, 10], { dark: true, key: "k" });
  assert.ok(tiles.length > 0);
  assert.ok(tiles.every((t) => t.url.includes("/dark_all/") && t.size > 128 && t.size <= 256));
  assert.ok(tiles.every((t) => t.url.endsWith("?key=k")));
  const covers = (x: number, y: number) =>
    tiles.some((t) => t.x <= x && x <= t.x + t.size && t.y <= y && y <= t.y + t.size);
  assert.ok(covers(0, 0) && covers(240, 120) && covers(0, 120) && covers(240, 0));
});

test("one spot zooms in only so far", () => {
  const { tiles } = previewBox([[135.5, 34.67]], [240, 120, 10], { dark: false, key: "k" });
  assert.ok(tiles.every((t) => t.url.includes("/16/")));
});

test("draws no tiles without an API key", () => {
  assert.deepEqual(previewBox(points, [240, 120, 10], { dark: false, key: "" }).tiles, []);
});
