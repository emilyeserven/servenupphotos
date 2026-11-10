import assert from "node:assert/strict";
import { test } from "node:test";
import type { FaceBox } from "@/lib/face-boxes";
import { areaBounds, inArea, turnToward, turnedGrid, turnedResize } from "@/lib/face-turn";

const photo = { width: 1000, height: 600 };

test("a box turned a quarter stands on its end", () => {
  const face: FaceBox = { x: 10, y: 25, width: 40, height: 10, blocks: 8, rotation: 90 };
  assert.equal(inArea(face, 30.5, 12.5), true);
  assert.equal(inArea(face, 12.5, 30.5), false);
  assert.deepEqual(areaBounds(face), { x: 25, y: 10, width: 10, height: 40 });
});

test("a turned area's blocks start at its bounds, and whole blocks are the ones it touches", () => {
  // Turned 45°, a 20 px square's bounds are 30 px across; 4 blocks make them 5 px each.
  const face: FaceBox = { x: 20, y: 20, width: 20, height: 20, blocks: 4, rotation: 45 };
  const grid = turnedGrid(face);
  assert.deepEqual(grid.cover, { x: 15, y: 15, width: 30, height: 30 });
  assert.equal(grid.cols, 6);
  const at = (x: number, y: number) => grid.cells.some((cell) => cell.x === x && cell.y === y);
  assert.equal(at(15, 15), false, "the corner block is outside the turned square");
  assert.equal(at(25, 15), true, "the block under the square's top corner is touched");
});

/** Where a box turned a quarter has its own top-left corner on the photo. */
function corner(f: FaceBox) {
  return {
    x: Math.round(f.x + f.width / 2 + f.height / 2),
    y: Math.round(f.y + f.height / 2 - f.width / 2),
  };
}

test("resizing a turned box keeps its opposite corner in place", () => {
  const start: FaceBox = { x: 100, y: 100, width: 100, height: 50, blocks: 8, rotation: 90 };
  // Turned a quarter, the box's own right is down on the photo: dragging the bottom-right corner
  // down 20 px makes it 20 px wider.
  const next = turnedResize(start, { dx: 1, dy: 1 }, 0, 20, photo);
  assert.equal(Math.round(next.width), 120);
  assert.equal(Math.round(next.height), 50);
  // The top-left corner, turned, is at the photo's top right of the area: it hasn't moved.
  assert.deepEqual(corner(next), corner(start));
});

test("the turn handle points at the pointer, snapping to 15° with Shift", () => {
  const center = { x: 0, y: 0 };
  assert.equal(turnToward(center, { x: 10, y: 0 }, false), 0);
  assert.equal(turnToward(center, { x: 0, y: 10 }, false), 90);
  assert.equal(turnToward(center, { x: 0, y: -10 }, false), -90);
  assert.equal(turnToward(center, { x: -10, y: 0 }, false), 180);
  assert.equal(turnToward(center, { x: 10, y: 9 }, true), 45);
});
