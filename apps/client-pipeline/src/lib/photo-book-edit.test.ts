import assert from "node:assert/strict";
import { test } from "node:test";
import { type PhotoBook, placePhoto } from "@/lib/photo-book";
import { firstEmptySlotOn, insertNewPage, insertPoints } from "@/lib/photo-book-edit";
import {
  addPage,
  addToBook,
  bookOrder,
  bookViews,
  setLinkNext,
  unitsInBook,
} from "@/lib/photo-book-order";

/** A book with four photo pages, page-1 to page-4, all in the book in that order. */
function fourPages(): PhotoBook {
  let book: PhotoBook = { id: "b", name: "B", template: "", pages: [] };
  for (let i = 0; i < 4; i += 1) book = addPage(book, "full");
  return ["page-1", "page-2", "page-3", "page-4"].reduce((b, id) => addToBook(b, id), book);
}

/** The insert points on view number n of book. */
function pointsOn(book: PhotoBook, n: number) {
  const used = unitsInBook(book);
  return insertPoints(bookViews(used)[n] as never, used);
}

test("the first view, facing the inside front cover, inserts before page 1 or after it", () => {
  assert.deepEqual(pointsOn(fourPages(), 0), [
    { edge: 1, at: 0 },
    { edge: 2, at: 1 },
  ]);
});

test("two pages facing each other insert before, between and after them", () => {
  assert.deepEqual(pointsOn(fourPages(), 1), [
    { edge: 0, at: 1 },
    { edge: 1, at: 2 },
    { edge: 2, at: 3 },
  ]);
});

test("a spread inserts only before or after it, never inside it", () => {
  const book = setLinkNext(fourPages(), "page-2", true);
  assert.deepEqual(pointsOn(book, 1), [
    { edge: 0, at: 1 },
    { edge: 2, at: 2 },
  ]);
});

test("the last page, facing the inside back cover, inserts before or after it", () => {
  const book = fourPages();
  assert.deepEqual(pointsOn(book, 2), [
    { edge: 0, at: 3 },
    { edge: 1, at: 4 },
  ]);
});

test("a new page goes into the book at the place given", () => {
  const { book, id } = insertNewPage(fourPages(), "pair-left", 2);
  assert.equal(id, "page-5");
  assert.deepEqual(bookOrder(book), ["page-1", "page-2", "page-5", "page-3", "page-4"]);
  assert.equal(book.pages.at(-1)?.layout, "pair-left");
});

test("the first empty place is looked for only on the pages given, in their order", () => {
  const book = placePhoto(fourPages(), { page: 2, slot: 0 }, "a.jpg");
  assert.deepEqual(firstEmptySlotOn(book, ["page-3", "page-4"]), { page: 3, slot: 0 });
  assert.equal(firstEmptySlotOn(book, ["page-3", "blank-1"]), null);
});
