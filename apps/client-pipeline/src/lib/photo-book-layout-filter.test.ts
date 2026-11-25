import assert from "node:assert/strict";
import { test } from "node:test";
import type { PhotoBook } from "@/lib/photo-book";
import { unitLayouts, unitsInLayout } from "@/lib/photo-book-layout-filter";
import { addOtherPage, addPage, bookUnits, setLinkNext } from "@/lib/photo-book-order";

/** A book with a full page, a spread of a pair-left and a full page, and an other page. */
const book = (): PhotoBook => {
  let b: PhotoBook = { id: "b", name: "B", template: "", pages: [] };
  b = addPage(addPage(addPage(b, "full"), "pair-left"), "full");
  return addOtherPage(setLinkNext(b, "page-2", true), "Bio");
};

test("the layouts in use are listed in the pickers' order, other pages last", () => {
  const b = book();
  const options = unitLayouts(b, bookUnits(b));
  assert.deepEqual(
    options.map((o) => o.id),
    ["full", "pair-left", "other"],
  );
  assert.equal(options.at(-1)?.label, "Other pages");
});

test("filtering by a layout keeps the pages and spreads with a page in it", () => {
  const b = book();
  const units = bookUnits(b);
  const options = unitLayouts(b, units);
  const ids = (layout: string | null) => {
    const { filter, shown } = unitsInLayout(units, options, layout);
    return [filter, shown.map((u) => u.id)];
  };
  assert.deepEqual(ids("full"), ["full", ["page-1", "page-2"]]);
  assert.deepEqual(ids("pair-left"), ["pair-left", ["page-2"]]);
  assert.deepEqual(ids("other"), ["other", ["page-4"]]);
  assert.deepEqual(ids(null)[1]?.length, 3);
  assert.deepEqual(ids("verticals-left"), [null, ["page-1", "page-2", "page-4"]]);
});
