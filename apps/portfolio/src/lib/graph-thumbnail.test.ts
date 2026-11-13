import assert from "node:assert/strict";
import { test } from "node:test";
import type { GraphData, ScatterData } from "@/lib/graph-data";
import {
  barShapes,
  heatmapShapes,
  lineShapes,
  photoDotShapes,
  pieShapes,
  scatterShapes,
  THUMB_HEIGHT,
  type ThumbShape,
} from "@/lib/graph-thumbnail";

/** A graph of one series with these values, one x value each. */
function single(...values: number[]): GraphData {
  return {
    series: [{ key: "value", label: "Photos", color: "blue" }],
    data: values.map((value, i) => ({ label: `v${i}`, photos: value, values: { value } })),
  };
}

/** A graph split in two series, a and b, with these pairs of values. */
function split(...pairs: [number, number][]): GraphData {
  return {
    series: [
      { key: "a", label: "A", color: "red" },
      { key: "b", label: "B", color: "green" },
    ],
    data: pairs.map(([a, b], i) => ({ label: `v${i}`, photos: a + b, values: { a, b } })),
  };
}

/** The shapes of one kind, narrowed to it. */
function only<K extends ThumbShape["kind"]>(shapes: ThumbShape[], kind: K) {
  return shapes.filter((s): s is Extract<ThumbShape, { kind: K }> => s.kind === kind);
}

test("bars are as tall as their share of the tallest, standing on one line", () => {
  const bars = only(barShapes(single(2, 4, 0), false), "rect");
  assert.equal(bars.length, 2, "an empty bar draws nothing");
  assert.equal(bars[1]!.height, bars[0]!.height * 2);
  assert.equal(bars[0]!.y + bars[0]!.height, bars[1]!.y + bars[1]!.height);
  assert.ok(bars[0]!.x < bars[1]!.x);
});

test("stacked parts sit on each other and side by side ones next to each other", () => {
  const stacked = only(barShapes(split([1, 1]), true), "rect");
  assert.deepEqual(
    stacked.map((s) => s.fill),
    ["red", "green"],
  );
  assert.equal(stacked[1]!.y + stacked[1]!.height, stacked[0]!.y);
  assert.equal(stacked[0]!.x, stacked[1]!.x);
  const side = only(barShapes(split([1, 1]), false), "rect");
  assert.equal(side[0]!.y, side[1]!.y);
  assert.ok(side[1]!.x > side[0]!.x);
});

test("no photos draw no bars or lines", () => {
  assert.deepEqual(barShapes(single(0, 0), false), []);
  assert.deepEqual(lineShapes(single()), []);
});

test("a line goes through each value, one line per series", () => {
  const lines = only(lineShapes(split([0, 2], [2, 0])), "line");
  assert.equal(lines.length, 2);
  const [first, second] = lines[0]!.points.split(" ").map((p) => p.split(",").map(Number));
  assert.ok(first![1]! > second![1]!, "the higher value is drawn higher up");
  assert.equal(first![1], THUMB_HEIGHT - 4);
});

test("a pie's slices take their share of the circle in the real pie's colors", () => {
  const slices = only(
    pieShapes(single(1, 1, 2), (i) => `c${i}`),
    "slice",
  );
  assert.deepEqual(
    slices.map((s) => s.fill),
    ["c0", "c1", "c2"],
  );
  assert.match(slices[2]!.d, / 0 0 1 /, "half the pie isn't the long way round");
  const whole = pieShapes(single(0, 5), (i) => `c${i}`);
  assert.equal(whole.length, 1);
  assert.deepEqual(
    only(whole, "circle").map((s) => s.fill),
    ["c1"],
  );
});

/** A 2 × 2 heatmap or scatterplot with photos at two pairs. */
const pairs: ScatterData = {
  xLabels: ["Jan", "Feb"],
  yLabels: ["2024", "2025"],
  points: [
    { x: 0, y: 0, count: 4 },
    { x: 1, y: 1, count: 1 },
  ],
};

test("a heatmap has a cell for every pair, the busiest strongest and empty ones gray", () => {
  const cells = only(heatmapShapes(pairs, "blue", "gray"), "rect");
  assert.equal(cells.length, 4);
  assert.deepEqual(
    cells.map((c) => [c.fill, c.opacity]),
    [
      ["blue", 1],
      ["gray", undefined],
      ["gray", undefined],
      ["blue", 0.4],
    ],
  );
  assert.ok(cells[0]!.y < cells[3]!.y, "the first y value is at the top");
});

test("a scatterplot has a dot for each pair with photos, bigger for more", () => {
  const dots = only(scatterShapes(pairs, "blue"), "circle");
  assert.equal(dots.length, 2);
  assert.ok(dots[0]!.r > dots[1]!.r);
  assert.ok(dots[0]!.cy > dots[1]!.cy, "the first y value is at the bottom");
});

test("photo dots stack one dot per photo, and share dots past the tallest stack's room", () => {
  const small = only(photoDotShapes([["a", "b"], ["a"]]), "circle");
  assert.deepEqual(
    small.map((d) => d.fill),
    ["a", "b", "a"],
  );
  assert.ok(small[1]!.cy < small[0]!.cy, "a stack grows upward");
  const big = only(
    photoDotShapes([Array<string>(28).fill("a"), Array<string>(14).fill("b")]),
    "circle",
  );
  assert.equal(big.length, 14 + 7, "each dot is two photos");
  assert.deepEqual(photoDotShapes([[], []]), []);
});
