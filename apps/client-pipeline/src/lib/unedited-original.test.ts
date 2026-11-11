import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cropOrMiddle,
  facesChecked,
  knownSize,
  middleCrop,
  movedCrop,
  originalFromJson,
  originalShown,
  originalUploadName,
  pixelatedOriginal,
  resizedCrop,
  scaledFaces,
  uploadedOriginal,
  withOriginal,
} from "@/lib/unedited-original";

const upload = {
  key: "photos/abcdef123456-dscf4800-original.jpg",
  url: "https://cdn/photos/abcdef123456-dscf4800-original.jpg",
  versions: { large: { key: "l", url: "https://cdn/l.webp" } },
} as Parameters<typeof uploadedOriginal>[0];
const original = uploadedOriginal(upload, "DSCF4800.jpg", { width: 6000, height: 4000 });
const area = { x: 100, y: 50, width: 40, height: 40, blocks: 8 };

test("an upload saves the original's JPEG, key, versions and size, and nothing else", () => {
  assert.deepEqual(original, {
    file: "DSCF4800.jpg",
    width: 6000,
    height: 4000,
    images: { full: upload.url, key: upload.key, large: "https://cdn/l.webp" },
  });
  assert.equal(originalUploadName("DSCF4800.jpg"), "DSCF4800-original");
  assert.equal(originalUploadName(""), "photo-original");
});

test("the original is set on the photo's JSON, read back, and taken off", () => {
  const data = withOriginal({ id: 3 }, original);
  assert.deepEqual(originalFromJson(data), original);
  assert.deepEqual(withOriginal(data, null), { id: 3 });
  assert.equal(originalFromJson({ original: "no" }), null);
});

test("a size is known only when both sides are positive numbers", () => {
  assert.deepEqual(knownSize({ width: 3, height: 2 }), { width: 3, height: 2 });
  assert.equal(knownSize({ width: 3, height: null }), null);
  assert.equal(knownSize({ width: 0, height: 2 }), null);
});

test("the starting crop is all of an original the edit's shape, or its largest middle part", () => {
  const size = { width: 6000, height: 4000 };
  assert.deepEqual(middleCrop(size, { width: 3000, height: 2000 }), { x: 0, y: 0, ...size });
  assert.deepEqual(middleCrop(size, { width: 1000, height: 1000 }), {
    x: 1000,
    y: 0,
    width: 4000,
    height: 4000,
  });
  const cropped = { ...original, crop: { x: 1, y: 2, width: 30, height: 20 } };
  assert.deepEqual(cropOrMiddle(cropped, size), cropped.crop);
});

test("the crop moves and resizes inside the original, keeping its shape", () => {
  const bounds = { width: 600, height: 400 };
  const crop = { x: 100, y: 100, width: 300, height: 200 };
  assert.deepEqual(movedCrop(crop, 500, -500, bounds), { ...crop, x: 300, y: 0 });
  assert.deepEqual(resizedCrop(crop, 1000, bounds), { ...crop, width: 450, height: 300 });
  assert.deepEqual(resizedCrop(crop, -1000, bounds), { ...crop, width: 20, height: 13 });
});

test("the photo's areas are scaled from the edit into the original's crop", () => {
  const crop = { x: 1000, y: 500, width: 2000, height: 1000 };
  const turned = { ...area, shape: "circle" as const, rotation: 30 };
  assert.deepEqual(scaledFaces([turned], { width: 1000, height: 500 }, crop), [
    { ...turned, x: 1200, y: 600, width: 80, height: 80 },
  ]);
});

test("the portfolio shows the original once its areas are saved against the photo's", () => {
  const shown = { ...original, showOnPortfolio: true };
  assert.equal(originalShown({ original: shown }), true);
  const photo = { faces: [area], original: shown };
  assert.equal(facesChecked(photo, shown), false);
  assert.equal(originalShown(photo), false);
  const pixelated = pixelatedOriginal(shown, [area], [area], "k1");
  assert.equal(originalShown({ ...photo, original: pixelated }), true);
  assert.equal(pixelated.images.large, "https://cdn/l.webp?faces=k1");
  assert.deepEqual(pixelated.faces, [area]);
  assert.equal(originalShown({ faces: [{ ...area, x: 1 }], original: pixelated }), false);
  assert.equal(originalShown({ original: { ...shown, showOnPortfolio: false } }), false);
});
