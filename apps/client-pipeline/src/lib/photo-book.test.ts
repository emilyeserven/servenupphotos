import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type PhotoBook,
  firstEmptySlot,
  pageAspect,
  placePhoto,
  removePhoto,
  setLayout,
} from "@/lib/photo-book";
import { addPage, removePage } from "@/lib/photo-book-order";

const book = (): PhotoBook =>
  addPage(addPage({ id: "b", name: "B", template: "", pages: [] }, "full"), "pair-left");

test("a new page gets its layout's empty places and an ID of its own", () => {
  const b = book();
  assert.deepEqual(
    b.pages.map((p) => [p.id, p.slots.length]),
    [
      ["page-1", 1],
      ["page-2", 2],
    ],
  );
  assert.equal(addPage(removePage(b, 0), "full").pages[1]?.id, "page-3");
});

test("a photo from the drawer fills a place, and one dragged from a page swaps with its caption", () => {
  let b = placePhoto(book(), { page: 0, slot: 0 }, "a.json");
  b = placePhoto(b, { page: 1, slot: 1 }, "b.json");
  b.pages[0]!.slots[0]!.caption = "By hand";
  b = placePhoto(b, { page: 1, slot: 1 }, "a.json", { page: 0, slot: 0 });
  assert.deepEqual(b.pages[0]?.slots[0], { photo: "b.json", caption: null });
  assert.deepEqual(b.pages[1]?.slots[1], { photo: "a.json", caption: "By hand" });
  assert.deepEqual(firstEmptySlot(b), { page: 1, slot: 0 });
  assert.equal(removePhoto(b, { page: 1, slot: 1 }).pages[1]?.slots[1]?.photo, "");
});

test("changing the layout keeps the photos in order and drops what doesn't fit", () => {
  let b = placePhoto(book(), { page: 1, slot: 0 }, "a.json");
  b = placePhoto(b, { page: 1, slot: 1 }, "b.json");
  const full = setLayout(b, 1, "full");
  assert.deepEqual(
    full.pages[1]?.slots.map((s) => s.photo),
    ["a.json"],
  );
  assert.equal(setLayout(full, 1, "pair-right").pages[1]?.slots.length, 2);
  assert.equal(setLayout(full, 1, "verticals-left").pages[1]?.slots.length, 2);
});

test("a page's shape comes from the book's size, or BookWright's large landscape page", () => {
  assert.equal(pageAspect({}), 900 / 765);
  assert.equal(pageAspect({ size: { width: 20, height: 25, unit: "cm" } }), 0.8);
  assert.equal(pageAspect({ size: { width: 0, height: 25, unit: "cm" } }), 900 / 765);
});
