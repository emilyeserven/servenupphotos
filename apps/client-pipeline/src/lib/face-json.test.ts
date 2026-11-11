import assert from "node:assert/strict";
import { test } from "node:test";
import { facesFromJson, pixelatedVersionUrl, withFaces } from "@/lib/face-json";

const area = { x: 1, y: 2, width: 30, height: 40, blocks: 8 };

test("the areas are saved in the photo JSON as the backend takes them, and left out when none", () => {
  const data = { id: 3, faces: [area] };
  assert.deepEqual(withFaces(data, [{ ...area, x: 1.4, rotation: 360, keep: false }]), {
    id: 3,
    faces: [area],
  });
  assert.deepEqual(withFaces(data, []), { id: 3 });
});

test("the areas are read back from the photo JSON, skipping anything that isn't one", () => {
  const turned = { ...area, shape: "circle", edge: "blocks", rotation: -30, keep: true };
  assert.deepEqual(facesFromJson({ faces: [turned, { x: "no" }, null] }), [turned]);
  assert.equal(facesFromJson({}), undefined);
  assert.deepEqual(facesFromJson({ faces: [] }), []);
});

test("the largest version is shown in place of the original once the faces are pixelated", () => {
  const images = { full: "f.jpg", xlarge: "x.webp?faces=abc", large: "l.webp?faces=abc" };
  assert.equal(pixelatedVersionUrl({ images }), "x.webp?faces=abc");
  assert.equal(pixelatedVersionUrl({ images: { ...images, xlarge: "" } }), "l.webp?faces=abc");
  assert.equal(
    pixelatedVersionUrl({ images: { full: "f.jpg", xlarge: "x.webp?crop=1" } }),
    undefined,
  );
  assert.equal(pixelatedVersionUrl({}), undefined);
});
