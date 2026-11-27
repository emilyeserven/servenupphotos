import assert from "node:assert/strict";
import { test } from "node:test";
import { photoContrast, photoLightness } from "@portfolio/lib/photo-colors";

/** A photo's colors with these lightness bins of blacks, grays and whites. */
function neutrals(histogram: { from: number; to?: number; share: number }[]) {
  return { neutrals: { histogram } };
}

test("a photo's lightness is its bins' middles averaged by share; a bin without an end is 5 wide", () => {
  assert.equal(
    photoLightness(
      neutrals([
        { from: 0, to: 10, share: 0.5 },
        { from: 90, share: 0.5 },
      ]),
    ),
    49,
  );
  assert.equal(photoLightness(neutrals([{ from: 40, to: 60, share: 0.2 }])), 50);
});

test("a photo's contrast is how far its bins spread from that lightness", () => {
  assert.equal(photoContrast(neutrals([{ from: 40, to: 60, share: 1 }])), 0);
  assert.equal(
    photoContrast(
      neutrals([
        { from: 0, to: 10, share: 0.5 },
        { from: 90, to: 100, share: 0.5 },
      ]),
    ),
    45,
  );
});

test("a photo without blacks, grays or whites has no lightness or contrast", () => {
  assert.equal(photoLightness(neutrals([])), null);
  assert.equal(photoLightness(neutrals([{ from: 0, to: 10, share: 0 }])), null);
  assert.equal(photoLightness({}), null);
  assert.equal(photoLightness(null), null);
  assert.equal(photoContrast(undefined), null);
});
