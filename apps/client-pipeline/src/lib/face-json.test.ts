import assert from "node:assert/strict";
import { test } from "node:test";
import {
  facesFromJson,
  facesToReapply,
  pixelatedVersionUrl,
  shownImageUrl,
  withFaces,
  withPixelatedFaces,
  withReappliedFaces,
} from "@/lib/face-json";

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

test("a photo shows its pixelated version when it has one, and its original when it doesn't", () => {
  assert.equal(
    shownImageUrl({ images: { xlarge: "x.webp?faces=abc" } }, "f.jpg"),
    "x.webp?faces=abc",
  );
  assert.equal(shownImageUrl({ images: { xlarge: "x.webp" } }, "f.jpg"), "f.jpg");
  assert.equal(shownImageUrl({}, undefined), undefined);
});

test("remade versions save their areas and get a new mark on every version's URL", () => {
  const data = { id: 3, images: { full: "f.jpg", xlarge: "x.webp" } };
  assert.deepEqual(withPixelatedFaces(data, [area], "m1"), {
    id: 3,
    images: { full: "f.jpg", xlarge: "x.webp?faces=m1" },
    faces: [area],
  });
  assert.deepEqual(withPixelatedFaces({ ...data, faces: [area] }, [], "m2").faces, undefined);
});

test("a replaced image of the same size gets the saved areas again, and of another size drops them", () => {
  const saved = { faces: [area] };
  assert.deepEqual(facesToReapply(saved, true), [area]);
  assert.deepEqual(facesToReapply(saved, false), []);
  assert.deepEqual(facesToReapply({}, true), []);
  const data = { ...saved, images: { xlarge: "x.webp" } };
  assert.deepEqual(withReappliedFaces(data, [area], "m").images, { xlarge: "x.webp?faces=m" });
  assert.deepEqual(withReappliedFaces(data, [], "m"), { images: { xlarge: "x.webp" } });
});
