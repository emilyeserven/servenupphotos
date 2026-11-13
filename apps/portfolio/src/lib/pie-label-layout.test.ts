import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LABEL_LINE_HEIGHT,
  pieLabelPlaces,
  type PieLabelPlace,
  sliceMidAngles,
  spreadLabels,
} from "@/lib/pie-label-layout";

/** A pie 600 by 300 pixels, centered, as the Graph page draws one with names around it. */
const GEOMETRY = { cx: 300, cy: 150, radius: 105, height: 300 };

/** The names on one side, top to bottom. */
function side(places: (PieLabelPlace | undefined)[], which: PieLabelPlace["side"]) {
  return places.filter((place) => place?.side === which).toSorted((a, b) => a!.y - b!.y);
}

test("slices' middle angles follow recharts' layout from 3 o'clock, counterclockwise", () => {
  assert.deepEqual(sliceMidAngles([1, 1, 2]), [45, 135, 270]);
  assert.deepEqual(sliceMidAngles([0, 0]), [0, 0]);
});

test("names that fit stay where they want to be", () => {
  assert.deepEqual(spreadLabels([20, 100, 200], 8, 292), [20, 100, 200]);
});

test("names too close together are pushed a line apart, kept inside the box", () => {
  const ys = spreadLabels([285, 286, 290], 8, 292);
  assert.deepEqual(ys, [292 - 2 * LABEL_LINE_HEIGHT, 292 - LABEL_LINE_HEIGHT, 292]);
});

test("names that can't fit a line apart share the room evenly", () => {
  assert.deepEqual(spreadLabels([50, 50, 50], 0, 20), [0, 10, 20]);
});

test("many small slices side by side get names at least a line apart, in their order", () => {
  const places = pieLabelPlaces([100, 2, 2, 2, 2, 2, 2, 2, 2], GEOMETRY);
  for (const which of ["left", "right"] as const) {
    const names = side(places, which);
    for (let i = 1; i < names.length; i++) {
      assert.ok(names[i]!.y - names[i - 1]!.y >= LABEL_LINE_HEIGHT - 1e-9);
    }
    for (const name of names) {
      assert.ok(
        name!.y >= LABEL_LINE_HEIGHT / 2 && name!.y <= GEOMETRY.height - LABEL_LINE_HEIGHT / 2,
      );
    }
  }
  assert.equal(places.filter(Boolean).length, 9);
});

test("each line runs from the slice's edge to its name's column", () => {
  const [, place] = pieLabelPlaces([1, 1, 2], GEOMETRY);
  assert.equal(place!.side, "left");
  const [edge, , end] = place!.points;
  assert.ok(Math.abs(Math.hypot(edge![0] - 300, edge![1] - 150) - 105) < 1e-9);
  assert.equal(end![0], 300 - 105 - 26);
  assert.equal(end![1], place!.y);
});

test("a slice with no photos gets no name", () => {
  assert.equal(pieLabelPlaces([3, 0, 2], GEOMETRY)[1], undefined);
});
