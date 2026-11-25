import assert from "node:assert/strict";
import { test } from "node:test";
import { type PhotoBook, placePhoto, setLayout } from "@/lib/photo-book";
import {
  BUILT_IN_LOOKS,
  addLayout,
  changeLayout,
  changeSide,
  customLayout,
  customPageLook,
  layoutName,
  layoutChoices,
  photoShape,
  pagesUsing,
  removeLayout,
  setHidden,
  setLeftPages,
  sideLook,
  textBeside,
  textFirst,
} from "@/lib/photo-book-layouts";
import { addPage } from "@/lib/photo-book-order";

/** A book with one pair page. */
const book = (): PhotoBook => addPage({ id: "b", name: "B", template: "", pages: [] }, "pair-left");

test("Customize copies a layout's settings into a new layout the pages can have", () => {
  const { book: b, id } = addLayout(book(), "verticals-right", "Big pair");
  assert.equal(id, "custom-1");
  assert.deepEqual(b.layouts?.[0], {
    ...BUILT_IN_LOOKS["verticals-right"],
    id,
    name: "Big pair",
    leftPages: "mirror",
  });
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

test("a layout's photos keep their shape's ratio, a custom one's own, or fill their room", () => {
  assert.equal(photoShape({ shape: "landscape" }), 1.5);
  assert.equal(photoShape({ shape: "ratio", ratio: { width: 4, height: 5 } }), 0.8);
  assert.equal(photoShape({ shape: "ratio", ratio: { width: 4, height: 0 } }), 1);
  assert.equal(photoShape({ shape: "fill" }), "fill");
});

test("a layout's left-hand pages look the same, mirrored, or their own way", () => {
  const added = addLayout(book(), "pair-left", "Pair");
  const { id } = added;
  let b = added.book;
  const right = sideLook(customLayout(b, id)!, "right");
  assert.equal(right.text, "right");
  assert.equal(sideLook(customLayout(b, id)!, "left").text, "left");
  b = setLeftPages(b, id, "same");
  assert.equal(sideLook(customLayout(b, id)!, "left").text, "right");
  b = setLeftPages(b, id, "own");
  assert.equal(customLayout(b, id)?.left?.text, "left");
  b = changeSide(b, id, "left", { gap: 7, photos: 1 });
  assert.equal(sideLook(customLayout(b, id)!, "left").gap, 7);
  assert.equal(sideLook(customLayout(b, id)!, "left").photos, 1);
  assert.equal(sideLook(customLayout(b, id)!, "right").gap, right.gap);
  assert.equal(customLayout(b, id)?.photos, 1);
  b = changeSide(setLeftPages(b, id, "mirror"), id, "left", { gap: 9 });
  assert.equal(sideLook(customLayout(b, id)!, "right").gap, 9);
  b = setLeftPages(b, id, "own");
  assert.equal(sideLook(customLayout(b, id)!, "left").gap, 7);
});

test("a hidden built-in layout leaves the pickers, except on a page that has it", () => {
  let b = setHidden(book(), "full", true);
  assert.deepEqual(setHidden(b, "full", true).hiddenLayouts, ["full"]);
  assert.ok(!layoutChoices(b).some((c) => c.id === "full"));
  assert.ok(layoutChoices(b, "full").some((c) => c.id === "full"));
  b = setHidden(b, "full", false);
  assert.ok(layoutChoices(b).some((c) => c.id === "full"));
});

test("a page with the book's own layout is drawn for its side; a built-in one isn't looked up", () => {
  const { book: b, id } = addLayout(book(), "pair-left", "Pair");
  const layouts = b.layouts ?? [];
  const page = { id: "p", layout: id };
  const sides = new Map([["p", "left" as const]]);
  assert.equal(customPageLook(layouts, page, sides)?.text, "left");
  assert.equal(customPageLook(layouts, page, sides, "right")?.text, "right");
  assert.equal(customPageLook(layouts, page, new Map())?.text, "right");
  assert.equal(customPageLook(layouts, { id: "p", layout: "full" }, sides), undefined);
});
