import assert from "node:assert/strict";
import { test } from "node:test";
import { orderedRows } from "./ordered-rows.ts";

/** A photo of the given width and height, numbered so its place in the order can be checked. */
function photo(id: number, width: number, height: number) {
  return { id, image: { width, height } };
}

const sizes = { wide: 200 };

/** A mix of wide and vertical photos, numbered in order. */
const mixed = Array.from({ length: 40 }, (_, i) =>
  i % 3 === 1 ? photo(i, 2000, 3000) : photo(i, 3000, 2000),
);

test("reading the rows left to right, top to bottom gives the photos in their order", () => {
  const rows = orderedRows(mixed, 1200, 1000, sizes);
  assert.deepEqual(
    rows.flatMap((row) => row.photos.map((p) => p.id)),
    mixed.map((p) => p.id),
  );
});

test("wide and vertical photos share rows", () => {
  const rows = orderedRows(mixed, 1200, 1000, sizes);
  assert.ok(rows.some((row) => new Set(row.photos.map((p) => p.image.height)).size > 1));
});

test("every row but the last fills the width exactly", () => {
  const rows = orderedRows(mixed, 1200, 1000, sizes);
  for (const row of rows.slice(0, -1)) {
    const width =
      row.photos.reduce((total, p) => total + (p.image.width / p.image.height) * row.height, 0) +
      12 * (row.photos.length - 1);
    assert.ok(row.full);
    assert.ok(Math.abs(width - 1200) < 0.01);
  }
});

test("rows stay near the height they aim for", () => {
  const rows = orderedRows(mixed, 1200, 1000, sizes);
  for (const row of rows) assert.ok(row.height > 150 && row.height < 400, `${row.height}`);
});

test("a short last row keeps its aimed height (a quarter over its starting height) instead of growing to fill the width", () => {
  const rows = orderedRows([photo(1, 3000, 2000)], 1200, 1000, sizes);
  assert.deepEqual(rows, [{ photos: [photo(1, 3000, 2000)], height: 250, full: false }]);
});

test("no row is taller than the most a tile can take up", () => {
  const rows = orderedRows([photo(1, 1000, 3000), photo(2, 1000, 3000)], 300, 150, sizes);
  assert.ok(rows.every((row) => row.height <= 150));
});
