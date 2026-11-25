import assert from "node:assert/strict";
import { test } from "node:test";
import { slotSources } from "@/lib/photo-book-image";

/** A 3000 × 2000 photo with its Small, Medium and X-Large versions. */
const photo = {
  width: 3000,
  height: 2000,
  images: { small: "s.webp", medium: "m.webp", xlarge: "xl.webp" },
};

test("a place's photo lists its versions and is drawn as wide as covering the place takes", () => {
  assert.deepEqual(slotSources(photo, { width: 600, height: 400 }), {
    srcSet: "s.webp 500w, m.webp 1200w, xl.webp 2500w",
    sizes: "600px",
  });
  // A portrait place crops the landscape photo, which is drawn wider than the place.
  assert.equal(slotSources(photo, { width: 200, height: 300 }).sizes, "450px");
});

test("no versions before the place is measured, or for a photo without a size", () => {
  assert.deepEqual(slotSources(photo, { width: 0, height: 0 }), {});
  assert.deepEqual(slotSources({ images: photo.images }, { width: 600, height: 400 }), {});
  assert.deepEqual(slotSources(undefined, { width: 600, height: 400 }), {});
});
