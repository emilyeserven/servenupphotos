import assert from "node:assert/strict";
import { test } from "node:test";
import type { CustomLayout, PhotoBook } from "@/lib/photo-book";
import { layoutChoices } from "@/lib/photo-book-layouts";
import {
  EMPTY_STANDARD,
  addStandard,
  copyOf,
  layoutRowNote,
  linkedStandard,
  removeStandard,
  saveAsStandard,
  setHiddenEverywhere,
} from "@/lib/photo-book-standard";

/** A layout of the book's own. */
const bigPair: CustomLayout = {
  id: "custom-1",
  name: "Big pair",
  photos: 2,
  arrange: "row",
  shape: "fill",
  text: "left",
  captions: "column",
  textShare: 30,
  align: "center",
  gap: 2,
  margin: 3,
  leftPages: "mirror",
};

/** A book with bigPair. */
const book = (layouts: CustomLayout[] = [bigPair]): PhotoBook => ({
  id: "b",
  name: "B",
  template: "",
  pages: [],
  layouts,
});

test("Save as standard layout adds the layout to the file and links the book's to it", () => {
  const saved = saveAsStandard(EMPTY_STANDARD, book(), "custom-1");
  assert.deepEqual(saved.file.layouts, [bigPair]);
  assert.equal(saved.book.layouts?.[0]?.standard, "custom-1");
});

test("Saving a linked layout again updates its standard layout instead of adding one", () => {
  const first = saveAsStandard(EMPTY_STANDARD, book(), "custom-1");
  const changed = book([{ ...first.book.layouts![0]!, margin: 8 }]);
  const again = saveAsStandard(first.file, changed, "custom-1");
  assert.equal(again.file.layouts.length, 1);
  assert.equal(again.file.layouts[0]?.margin, 8);
  assert.equal(again.file.layouts[0]?.standard, undefined);
});

test("A layout linked to a removed standard layout is saved as a new one", () => {
  const first = saveAsStandard(EMPTY_STANDARD, book(), "custom-1");
  const emptied = removeStandard(first.file, "custom-1");
  assert.equal(linkedStandard(emptied, first.book.layouts![0]!), undefined);
  assert.equal(saveAsStandard(emptied, first.book, "custom-1").file.layouts.length, 1);
});

test("Adding a standard layout to a book copies it under a new ID, linked to it", () => {
  const file = { ...EMPTY_STANDARD, layouts: [bigPair] };
  const added = addStandard(book(), file, "custom-1");
  assert.equal(added.id, "custom-2");
  assert.deepEqual(added.book.layouts?.[1], { ...bigPair, id: "custom-2", standard: "custom-1" });
  assert.equal(copyOf(added.book, "custom-1")?.id, "custom-2");
  assert.equal(addStandard(book(), file, "custom-9").id, undefined);
});

test("A built-in layout hidden in every book leaves every book's pickers", () => {
  const file = setHiddenEverywhere(EMPTY_STANDARD, "full", true);
  assert.deepEqual(file.hiddenLayouts, ["full"]);
  const ids = layoutChoices(book(), undefined, file.hiddenLayouts).map((c) => c.id);
  assert.ok(!ids.includes("full"));
  assert.ok(layoutChoices(book(), "full", file.hiddenLayouts).some((c) => c.id === "full"));
  assert.deepEqual(setHiddenEverywhere(file, "full", false).hiddenLayouts, []);
});

test("A layout's row says where it's hidden and how many pages have it", () => {
  assert.equal(layoutRowNote(0, false, false), "Not on any page");
  assert.equal(layoutRowNote(2, false, false), "On 2 pages");
  assert.equal(layoutRowNote(0, true, false), "Hidden from Photo Pages");
  assert.equal(layoutRowNote(1, true, true), "Hidden in every book · on 1 page");
});
