import assert from "node:assert/strict";
import { test } from "node:test";
import {
  blockSide,
  drawnBox,
  type FaceBox,
  isBigEnough,
  keyedBox,
  middleBox,
  movedBox,
  newFaces,
  resizedBox,
  roundedBox,
  sameBoxes,
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

test("a box drawn backwards is the same box, clipped to the photo", () => {
  assert.deepEqual(drawnBox({ x: 300, y: 700 }, { x: 100, y: 500 }, photo, 5), {
    x: 100,
    y: 500,
    width: 200,
    height: 100,
    blocks: 5,
  });
  assert.equal(isBigEnough(drawnBox({ x: 10, y: 10 }, { x: 12, y: 40 }, photo)), false);
});

test("a box added by hand sits in the middle", () => {
  assert.deepEqual(middleBox(photo), { x: 450, y: 250, width: 100, height: 100, blocks: 8 });
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
