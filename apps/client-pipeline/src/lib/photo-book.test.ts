import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type PhotoBook,
  addPage,
  firstEmptySlot,
  addToBook,
  bookOrder,
  bookPages,
  moveInBook,
  pageNumbers,
  photosInBook,
  placePhoto,
  removePage,
  removePhoto,
  repeatedPhotos,
  setLayout,
  takeOutOfBook,
} from "@/lib/photo-book";

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

test("the book is the pages its order lists, which new pages aren't in until added", () => {
  let b = placePhoto(book(), { page: 0, slot: 0 }, "a.json");
  b = placePhoto(b, { page: 1, slot: 0 }, "a.json");
  assert.deepEqual(bookOrder(b), []);
  assert.deepEqual(firstEmptySlot(b), { page: 1, slot: 1 });
  b = addToBook(addToBook(b, "page-2"), "page-1");
  assert.deepEqual(
    [...pageNumbers(b)],
    [
      ["page-2", 1],
      ["page-1", 2],
    ],
  );
  assert.deepEqual([...repeatedPhotos(b)], [["a.json", [1, 2]]]);
  b = moveInBook(takeOutOfBook(b, "page-2"), 0, 0);
  assert.deepEqual(
    bookPages(b).map((p) => p.id),
    ["page-1"],
  );
  assert.equal(repeatedPhotos(b).size, 0);
  assert.deepEqual([...photosInBook(b)], ["a.json"]);
  assert.deepEqual(bookOrder(removePage(b, 0)), []);
});

test("a book from before the order has every page in it, and keeps them when one is added", () => {
  const before: PhotoBook = { ...book(), order: undefined };
  assert.deepEqual(bookOrder(before), ["page-1", "page-2"]);
  assert.deepEqual(bookOrder(addPage(before, "full")), ["page-1", "page-2"]);
  assert.deepEqual(bookOrder({ ...before, order: ["page-2", "gone", "page-2"] }), ["page-2"]);
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
