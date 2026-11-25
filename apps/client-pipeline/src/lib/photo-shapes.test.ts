import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { combinedPhotoShape, photosOfShape, shapeCounts } from "@/lib/photo-shapes";

const wide = { file: "wide.jpg", width: 6000, height: 4000 };
const tall = { file: "tall.jpg", width: 4000, height: 6000 };
const square = { file: "square.jpg", width: 3000, height: 3000 };
const unsized = { file: "unsized.jpg", width: null, height: null };

describe("combinedPhotoShape", () => {
  it("reads the shape from the JSON's width and height", () => {
    assert.equal(combinedPhotoShape(wide), "landscape");
    assert.equal(combinedPhotoShape(tall), "portrait");
    assert.equal(combinedPhotoShape(square), "square");
  });

  it("has none for a photo without a size", () => {
    assert.equal(combinedPhotoShape(unsized), undefined);
  });
});

describe("photosOfShape", () => {
  const photos = [wide, tall, square, unsized];

  it("keeps every photo when no shape is chosen", () => {
    assert.deepEqual(photosOfShape(photos), photos);
  });

  it("keeps only the photos of the chosen shape", () => {
    assert.deepEqual(photosOfShape(photos, "portrait"), [tall]);
  });
});

describe("shapeCounts", () => {
  it("counts each shape, leaving out photos without a size", () => {
    assert.deepEqual(shapeCounts([wide, wide, tall, unsized]), {
      landscape: 2,
      portrait: 1,
      square: 0,
    });
  });
});
