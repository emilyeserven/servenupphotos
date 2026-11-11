import assert from "node:assert/strict";
import { test } from "node:test";
import {
  areaName,
  blockSide,
  drawnBox,
  type FaceBox,
  hasEdge,
  isBigEnough,
  keyedBox,
  middleBox,
  movedBox,
  newFaces,
  normalRotation,
  resizedBox,
  roundedBox,
  sameBoxes,
  touchedCells,
  withFacesMark,
} from "@/lib/face-boxes";

const photo = { width: 1000, height: 600 };
const face: FaceBox = { x: 100, y: 100, width: 200, height: 100, blocks: 8 };

test("blocks span the box's longer side", () => {
  assert.equal(blockSide(face), 25);
  assert.equal(blockSide({ ...face, width: 201 }), 26);
});

test("a moved box stays inside the photo", () => {
  assert.deepEqual(movedBox(face, 5000, -500, photo), { ...face, x: 800, y: 0 });
});

test("dragging the bottom right corner grows the box, up to the photo's edge", () => {
  const grown = resizedBox(face, { dx: 1, dy: 1 }, 50, 2000, photo);
  assert.deepEqual(grown, { ...face, width: 250, height: 500 });
});

test("dragging the top left corner keeps the bottom right one in place", () => {
  const grown = resizedBox(face, { dx: -1, dy: -1 }, -50, 60, photo);
  assert.equal(grown.x + grown.width, 300);
  assert.equal(grown.y + grown.height, 200);
  assert.deepEqual(grown, { ...face, x: 50, width: 250, y: 160, height: 40 });
});

/** What every new area starts as: a circle with whole-block edges. */
const circle = { shape: "circle", edge: "blocks" };

test("a box drawn backwards is the same box, clipped to the photo", () => {
  assert.deepEqual(drawnBox({ x: 300, y: 700 }, { x: 100, y: 500 }, photo, 5), {
    x: 100,
    y: 500,
    width: 200,
    height: 100,
    blocks: 5,
    ...circle,
  });
  assert.equal(isBigEnough(drawnBox({ x: 10, y: 10 }, { x: 12, y: 40 }, photo)), false);
});

test("a circle added by hand sits in the middle", () => {
  assert.deepEqual(middleBox(photo), {
    x: 450,
    y: 250,
    width: 100,
    height: 100,
    blocks: 8,
    ...circle,
  });
});

test("a circle added while zoomed in sits in the middle of the view, sized to it, inside the photo", () => {
  const view = { width: 300, height: 180 };
  assert.deepEqual(middleBox(photo, { x: 200, y: 100 }, view), {
    x: 185,
    y: 85,
    width: 30,
    height: 30,
    blocks: 8,
    ...circle,
  });
  assert.deepEqual(middleBox(photo, { x: 990, y: 5 }, view), {
    x: 970,
    y: 0,
    width: 30,
    height: 30,
    blocks: 8,
    ...circle,
  });
});

test("the backend gets a whole turn from -180 to 180, and an edge only where it matters", () => {
  const box = { x: 0, y: 0, width: 10, height: 10, blocks: 8 };
  assert.deepEqual(roundedBox({ ...box, rotation: 270.4, edge: "blocks" }), {
    ...box,
    rotation: -90,
    edge: "blocks",
  });
  assert.deepEqual(roundedBox({ ...box, rotation: 360, edge: "blocks" }), box);
  assert.equal(normalRotation(-180), 180);
  assert.equal(hasEdge({ ...box, rotation: 5 }), true);
  assert.equal(hasEdge(box), false);
});

test("the backend gets whole pixels and blocks in range", () => {
  assert.deepEqual(roundedBox({ x: -0.4, y: 1.6, width: 10.2, height: 0, blocks: 99 }), {
    x: 0,
    y: 2,
    width: 10,
    height: 1,
    blocks: 40,
  });
  assert.ok(sameBoxes([face], [{ ...face, x: 100.2 }]));
  assert.ok(!sameBoxes([face], [{ ...face, blocks: 9 }]));
});

test("arrow keys move a box, and other keys do nothing", () => {
  assert.deepEqual(keyedBox("ArrowRight", false, face, photo), { ...face, x: 110 });
  assert.deepEqual(keyedBox("ArrowUp", true, face, photo), { ...face, y: 0 });
  assert.equal(keyedBox("a", false, face, photo), undefined);
});

test("every version's URL is marked, keeping the crop mark", () => {
  const images = {
    key: "photos/a.jpg",
    full: "https://cdn/photos/a.jpg",
    small: "https://cdn/photos/a-small.webp",
    thumbnail: "https://cdn/photos/a-thumbnail.webp?crop=1,2,300",
    thumbnailcrop: { x: 1, y: 2, size: 300, outputSize: 500 },
  };
  const marked = withFacesMark(images, "abc");
  assert.equal(marked.small, "https://cdn/photos/a-small.webp?faces=abc");
  assert.equal(marked.thumbnail, "https://cdn/photos/a-thumbnail.webp?crop=1,2,300&faces=abc");
  assert.equal(marked.full, images.full);
  assert.equal(marked.key, images.key);
  assert.equal(withFacesMark(marked, "def").small, "https://cdn/photos/a-small.webp?faces=def");
});

test("finding faces again only adds the ones not boxed yet", () => {
  const near = { ...face, x: 110, y: 105 };
  const far = { ...face, x: 600, y: 300 };
  assert.deepEqual(newFaces([face], [near, far]), [far]);
});

test("only a circle's shape, a whole-block edge and a keep mark go to the backend", () => {
  assert.deepEqual(roundedBox({ ...face, shape: "box", edge: "blocks" }), face);
  assert.deepEqual(roundedBox({ ...face, shape: "circle", edge: "inside" }), {
    ...face,
    shape: "circle",
  });
  assert.deepEqual(roundedBox({ ...face, shape: "circle", edge: "blocks", keep: true }), {
    ...face,
    shape: "circle",
    edge: "blocks",
    keep: true,
  });
  assert.ok(!sameBoxes([face], [{ ...face, keep: true }]));
});

test("a kept area is named apart from the faces", () => {
  assert.equal(areaName(face, 0), "Face 1");
  assert.equal(areaName({ ...face, keep: true }, 2), "Keep 3");
});

test("a circle touches every cell of a 4 × 4 grid, and all but the corners of an 8 × 8 one", () => {
  const square = { x: 0, y: 0, width: 40, height: 40, blocks: 8 };
  assert.equal(touchedCells(square, 4, 4).length, 16);
  // With 8 × 8 cells, each corner cell lies outside the circle.
  const cells = touchedCells(square, 8, 8);
  assert.equal(cells.length, 60);
  assert.ok(!cells.some((cell) => cell.x === 0 && cell.y === 0));
});
