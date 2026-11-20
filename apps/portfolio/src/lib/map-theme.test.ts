import assert from "node:assert/strict";
import { test } from "node:test";
import { tripColors, tripLinePaint, tripLineStroke, tripLineStyle } from "@portfolio/lib/map-theme";

const light = tripColors(false);
const dark = tripColors(true);

test("walks, drives and rides on a picked line are solid", () => {
  assert.deepEqual(tripLineStyle("walk", {}, false), { color: light.walk, width: 3 });
  assert.deepEqual(tripLineStyle("car", {}, true), { color: dark.drive, width: 3 });
  assert.deepEqual(tripLineStyle("train", { onLine: true, colour: "#e5171f" }, false), {
    color: "#e5171f",
    width: 3,
  });
});

test("a ride on a line with no color of its own is the ride blue", () => {
  assert.equal(tripLineStyle("bus", { onLine: true }, true).color, dark.ride);
});

test("a hop with no line picked is dashed purple, thinner", () => {
  assert.deepEqual(tripLineStyle("train", {}, false), {
    color: light.hop,
    width: 2,
    dash: [2, 2],
  });
});

test("a walk keeps its own style even with a line's color", () => {
  assert.equal(tripLineStyle("walk", { onLine: true, colour: "#e5171f" }, false).color, light.walk);
});

test("ferries are dotted and flights dashed", () => {
  assert.deepEqual(tripLineStyle("ferry", {}, false).dash, [0.1, 2]);
  assert.deepEqual(tripLineStyle("flight", {}, false).dash, [3, 2]);
});

test("sketches draw thinner lines", () => {
  assert.equal(tripLineStyle("walk", {}, false, "sketch").width, 2);
  assert.equal(tripLineStyle("train", {}, false, "sketch").width, 1.5);
});

test("MapLibre paint and SVG strokes carry the same style", () => {
  const hop = tripLineStyle("train", {}, false);
  assert.deepEqual(tripLinePaint(hop), {
    "line-color": light.hop,
    "line-width": 2,
    "line-dasharray": [2, 2],
  });
  assert.deepEqual(tripLineStroke(hop), {
    stroke: light.hop,
    strokeWidth: 2,
    strokeDasharray: "4 4",
  });
  assert.deepEqual(tripLineStroke(tripLineStyle("walk", {}, false)), {
    stroke: light.walk,
    strokeWidth: 3,
  });
});
