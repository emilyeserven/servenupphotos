import assert from "node:assert/strict";
import { test } from "node:test";
import { walkLine } from "@/lib/station-walks";

const x = { latitude: 1, longitude: 10 };
const y = { latitude: 2, longitude: 20 };

test("a station walk with a path along streets is drawn along it, read as longitude then latitude", () => {
  const walk = {
    via: [{ latitude: 9, longitude: 9 }],
    path: [
      [10, 1],
      [15, 1.5],
      [20, 2],
    ] as [number, number][],
  };
  assert.deepEqual(walkLine(walk, x, y), [
    { latitude: 1, longitude: 10 },
    { latitude: 1.5, longitude: 15 },
    { latitude: 2, longitude: 20 },
  ]);
});

test("a station walk without a path of two points goes straight through its via spots", () => {
  const via = { latitude: 1.5, longitude: 12 };
  assert.deepEqual(walkLine({ via: [via], path: [[10, 1]] }, x, y), [x, via, y]);
  assert.deepEqual(walkLine({ via: [via] }, x, y), [x, via, y]);
  assert.deepEqual(walkLine({}, x, y), [x, y]);
  assert.deepEqual(walkLine(undefined, x, y), [x, y]);
});
