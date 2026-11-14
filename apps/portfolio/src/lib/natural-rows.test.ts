import assert from "node:assert/strict";
import { test } from "node:test";
import { naturalRows, rowHeightOf } from "./natural-rows.ts";

/** A photo of the given width and height. */
function photo(width: number, height: number) {
  return { image: { width, height } };
}

const sizes = { wide: 150 };

test("a 2:3 vertical photo covers the same area as a 3:2 wide one", () => {
  const wide = photo(3000, 2000);
  const tall = photo(2000, 3000);
  const area = (p: typeof wide) => {
    const height = rowHeightOf(p, sizes);
    return height * height * (p.image.width / p.image.height);
  };
  assert.equal(rowHeightOf(wide, sizes), 150);
  assert.equal(rowHeightOf(tall, sizes), 225);
  assert.ok(Math.abs(area(tall) - area(wide)) < 1);
});

test("vertical photos still get rows of their own, at their taller height", () => {
  const photos = [
    ...Array.from({ length: 10 }, () => photo(3000, 2000)),
    ...Array.from({ length: 20 }, () => photo(2000, 3000)),
  ];
  const rows = naturalRows(photos, 1200, 1000, sizes);
  const tallRow = rows.find((row) => row.photos[0]!.image.height === 3000)!;
  assert.equal(tallRow.height, 225);
  assert.ok(tallRow.photos.every((p) => p.image.height === 3000));
});

test("a vertical row is never taller than the most a tile can take up", () => {
  assert.equal(
    naturalRows([photo(1000, 3000), photo(1000, 3000)], 100, 200, sizes)[0]!.height,
    200,
  );
});
