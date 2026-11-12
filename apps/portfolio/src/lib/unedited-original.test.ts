import assert from "node:assert/strict";
import { test } from "node:test";
import { isPublishedOriginal, publicOriginal } from "@/lib/unedited-original";

const area = { x: 1, y: 2, width: 30, height: 40, blocks: 8 };
const original = {
  file: "DSCF4800.jpg",
  width: 6000,
  height: 4000,
  images: { full: "o.jpg", key: "photos/o.jpg", large: "o-large.webp" },
  crop: { x: 10, y: 20, width: 3000, height: 2000 },
  showOnPortfolio: true,
};

test("an original stays in the pipeline unless it's marked to show", () => {
  assert.equal(isPublishedOriginal({}), false);
  assert.equal(isPublishedOriginal({ original: { ...original, showOnPortfolio: false } }), false);
  assert.equal(isPublishedOriginal({ original }), true);
});

test("a photo with pixelated faces needs the original's saved against them", () => {
  assert.equal(isPublishedOriginal({ faces: [area], original }), false);
  const matched = { ...original, faces: [area], matchedFaces: [area] };
  assert.equal(isPublishedOriginal({ faces: [area], original: matched }), true);
  assert.equal(isPublishedOriginal({ faces: [{ ...area, x: 5 }], original: matched }), false);
});

test("the portfolio gets the original's size, crop and versions, without its JPEG or key", () => {
  assert.deepEqual(publicOriginal({ original }), {
    width: 6000,
    height: 4000,
    images: { large: "o-large.webp" },
    crop: original.crop,
    showOnPortfolio: true,
  });
  assert.equal(publicOriginal({ faces: [area], original }), undefined);
});
