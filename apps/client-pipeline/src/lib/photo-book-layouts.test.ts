import assert from "node:assert/strict";
import { test } from "node:test";
import { type PhotoBook, placePhoto, setLayout } from "@/lib/photo-book";
import {
  BUILT_IN_LOOKS,
  addLayout,
  changeLayout,
  layoutName,
  layoutChoices,
  pagesUsing,
  removeLayout,
  textBeside,
  textFirst,
} from "@/lib/photo-book-layouts";
import { addPage } from "@/lib/photo-book-order";

/** A book with one pair page. */
const book = (): PhotoBook => addPage({ id: "b", name: "B", template: "", pages: [] }, "pair-left");

test("Customize copies a layout's settings into a new layout the pages can have", () => {
  const { book: b, id } = addLayout(book(), "verticals-right", "Big pair");
  assert.equal(id, "custom-1");
  assert.deepEqual(b.layouts?.[0], { ...BUILT_IN_LOOKS["verticals-right"], id, name: "Big pair" });
  assert.equal(addLayout(b, id, "Copy").id, "custom-2");
  assert.equal(layoutName(b, id), "Big pair");
  assert.equal(layoutChoices(b).at(-1)?.id, id);
  assert.equal(layoutChoices(b).at(-1)?.description, "2 photos in a row, 2:3, text on the left.");
});

test("a layout holding fewer photos takes the extra ones off its pages, and removing it makes them full pages", () => {
  const added = addLayout(book(), "pair-left", "Mine");
  let b = setLayout(added.book, 0, added.id);
  b = placePhoto(placePhoto(b, { page: 0, slot: 0 }, "a.json"), { page: 0, slot: 1 }, "b.json");
  assert.equal(pagesUsing(b, added.id), 1);
  b = changeLayout(b, added.id, { photos: 3 });
  assert.deepEqual(
    b.pages[0]?.slots.map((s) => s.photo),
    ["a.json", "b.json", ""],
  );
  b = changeLayout(b, added.id, { photos: 1, shape: "fill" });
  assert.deepEqual(
    b.pages[0]?.slots.map((s) => s.photo),
    ["a.json"],
  );
  b = removeLayout(b, added.id);
  assert.equal(b.pages[0]?.layout, "full");
  assert.deepEqual(b.layouts, []);
});

test("the text's side says whether it's beside the photos and whether it comes first", () => {
  assert.deepEqual(
    (["left", "right", "above", "below"] as const).map((text) => [
      textBeside({ text }),
      textFirst({ text }),
    ]),
    [
      [true, true],
      [true, false],
      [false, true],
      [false, false],
    ],
  );
});
