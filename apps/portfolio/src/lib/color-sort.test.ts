import assert from "node:assert/strict";
import { test } from "node:test";
import { type SortSpec, sortPhotos } from "@portfolio/lib/color-sort";
import type { ColorShare } from "@portfolio/lib/photo-colors";

/** A photo named id with this palette, largest color first, and vividness. */
function photo(id: string, palette: ColorShare[], vividness = 0) {
  return { id, palette, vividness, peakVividness: vividness };
}

const BY_COLOR: SortSpec = {
  sort: "color",
  order: "asc",
  secondaryOrder: "asc",
  measure: "average",
};

/** The photos' names in the order spec sorts them. */
function order(photos: ReturnType<typeof photo>[], spec: SortSpec): string[] {
  return sortPhotos(photos, spec).map((p) => p.id);
}

const red = photo("red", [{ color: "red", share: 0.9 }], 40);
const blue = photo("blue", [{ color: "blue", share: 0.6 }], 10);
const white = photo("white", [{ color: "white", share: 1 }], 0);
const mostlyBlue = photo(
  "mostly blue",
  [
    { color: "blue", share: 0.4 },
    { color: "red", share: 0.3 },
  ],
  30,
);

test("photos sort around the color wheel, then through the shades", () => {
  assert.deepEqual(order([white, blue, red], BY_COLOR), ["red", "blue", "white"]);
  assert.deepEqual(order([white, blue, red], { ...BY_COLOR, order: "desc" }), [
    "white",
    "blue",
    "red",
  ]);
});

test("with a picked color, the photos with the most of it come first", () => {
  assert.deepEqual(order([red, blue, mostlyBlue], { ...BY_COLOR, color: "blue" }), [
    "blue",
    "mostly blue",
    "red",
  ]);
});

test("grouped by color, a secondary sort orders the photos within each group", () => {
  const spec: SortSpec = { ...BY_COLOR, secondary: "vivid", secondaryOrder: "desc" };
  assert.deepEqual(order([blue, red, mostlyBlue], spec), ["red", "mostly blue", "blue"]);
  // A picked color groups by bands of 10% of it.
  const lessBlue = photo("less blue", [{ color: "blue", share: 0.58 }], 50);
  assert.deepEqual(order([blue, lessBlue], { ...spec, color: "blue" }), ["less blue", "blue"]);
});

test("photos can sort by how vivid they are", () => {
  assert.deepEqual(order([blue, red, white], { ...BY_COLOR, sort: "vivid", order: "desc" }), [
    "red",
    "blue",
    "white",
  ]);
});
