import assert from "node:assert/strict";
import { test } from "node:test";
import { type PhotoBook, placePhoto } from "@/lib/photo-book";
import {
  addOtherPage,
  addPage,
  addToBook,
  addToBookBefore,
  bookOrder,
  bookPages,
  bookUnits,
  bookTags,
  bookViews,
  moveInBook,
  movePhotoUnit,
  pageNumbers,
  pageSides,
  photosInBook,
  removePage,
  repeatedPhotos,
  setLinkNext,
  setUnitTags,
  takeOutOfBook,
  unitTags,
  unitsInBook,
  unitsTagged,
  viewOf,
} from "@/lib/photo-book-order";

/** A book with three photo pages, none in the book yet. */
const book = (): PhotoBook =>
  addPage(
    addPage(addPage({ id: "b", name: "B", template: "", pages: [] }, "full"), "full"),
    "full",
  );

/** Each unit's pages' IDs. */
const units = (b: PhotoBook) => bookUnits(b).map((u) => u.pages.map((p) => p.id));

test("the book is the units its order lists, which new pages aren't in until added", () => {
  let b = placePhoto(book(), { page: 0, slot: 0 }, "a.json");
  b = placePhoto(b, { page: 1, slot: 0 }, "a.json");
  assert.deepEqual(bookOrder(b), []);
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
  assert.deepEqual(bookOrder(addToBook(b, "page-3", 0)), ["page-3", "page-1"]);
});

test("a book from before the order has every page in it, and keeps them when one is added", () => {
  const before: PhotoBook = { ...book(), order: undefined };
  assert.deepEqual(bookOrder(before), ["page-1", "page-2", "page-3"]);
  assert.deepEqual(bookOrder(addPage(before, "full")), ["page-1", "page-2", "page-3"]);
  assert.deepEqual(bookOrder({ ...before, order: ["page-2", "gone", "page-2"] }), ["page-2"]);
});

test("a photo page linked to the next makes a spread, which goes in the book as one", () => {
  let b = setLinkNext(book(), "page-1", true);
  assert.deepEqual(units(b), [["page-1", "page-2"], ["page-3"]]);
  b = addToBook(addToBook(b, "page-3"), "page-1");
  assert.deepEqual(
    bookPages(b).map((p) => p.id),
    ["page-3", "page-1", "page-2"],
  );
  // An order listing a spread's second page means the spread.
  assert.deepEqual(bookOrder({ ...b, order: ["page-2", "page-1"] }), ["page-1"]);
  // A spread's second page can't link on to a third.
  assert.deepEqual(units(setLinkNext(b, "page-2", true)), [["page-1", "page-2"], ["page-3"]]);
});

test("moving a photo page pairs it with another, and removing half a spread keeps the other half", () => {
  let b = setLinkNext(movePhotoUnit(book(), 2, -1), "page-1", true);
  assert.deepEqual(units(b), [["page-1", "page-3"], ["page-2"]]);
  b = removePage(addToBook(b, "page-1"), 0);
  assert.deepEqual(units(b), [["page-3"], ["page-2"]]);
  assert.deepEqual(bookOrder(b), ["page-3"]);
  assert.equal(movePhotoUnit(b, 0, -1), b);
});

test("an other page is added straight to the end of the book, on its own", () => {
  const b = addOtherPage(addToBook(setLinkNext(book(), "page-2", true), "page-1"), "Bio");
  assert.deepEqual(units(b), [["page-1"], ["page-2", "page-3"], ["page-4"]]);
  assert.deepEqual(bookOrder(b), ["page-1", "page-4"]);
  assert.equal(b.pages[3]?.name, "Bio");
  assert.equal(b.pages[3]?.slots.length, 0);
});

test("the preview shows units one at a time, or facing: spreads alone, other pages in twos", () => {
  let b = addOtherPage(addOtherPage(book(), "Bio"), "Credits");
  const [p1, p2, p3] = b.pages.map((p) => p.id);
  b = setLinkNext(b, p2 as string, true);
  b = addToBookBefore(b, p3 as string, null);
  b = addToBookBefore(b, p1 as string, b.pages[4]?.id ?? null);
  const ids = (facing: boolean) =>
    bookViews(unitsInBook(b), facing).map((v) => v.pages.map((p) => p.name ?? p.id));
  assert.deepEqual(ids(false), [["Bio"], [p1], ["Credits"], [p2, p3]]);
  assert.deepEqual(ids(true), [["Bio", p1], ["Credits"], [p2, p3]]);
  assert.equal(viewOf(bookViews(unitsInBook(b), true), p2 as string), 2);
});

test("tagging a spread tags both its pages, and the book lists every tag once", () => {
  let b = book();
  const [p1, p2, p3] = b.pages.map((p) => p.id) as [string, string, string];
  b = setLinkNext(b, p1, true);
  b = setUnitTags(b, p1, [" by place ", "draft", "by place", ""]);
  b = setUnitTags(b, p3, ["by theme"]);
  assert.deepEqual(
    b.pages.map((p) => p.tags),
    [["by place", "draft"], ["by place", "draft"], ["by theme"]],
  );
  assert.deepEqual(unitTags(bookUnits(b)[0]!), ["by place", "draft"]);
  assert.deepEqual(bookTags(b), ["by place", "by theme", "draft"]);
  const tagged = (tag: string | null) => {
    const { filter, shown } = unitsTagged(bookUnits(b), bookTags(b), tag);
    return [filter, shown.map((u) => u.id)];
  };
  assert.deepEqual(tagged("by theme"), ["by theme", [p3]]);
  assert.deepEqual(tagged("gone"), [null, [p1, p3]]);
  assert.equal(p2, b.pages[1]?.id);
});

test("a page in the book is on the side its number gives; one not in it, on its spread's side", () => {
  let b = setLinkNext(book(), "page-1", true);
  assert.deepEqual(Object.fromEntries(pageSides(b)), {
    "page-1": "left",
    "page-2": "right",
    "page-3": "right",
  });
  b = addToBook(addToBook(b, "page-3"), "page-1");
  assert.deepEqual(Object.fromEntries(pageSides(b)), {
    "page-1": "left",
    "page-2": "right",
    "page-3": "right",
  });
  b = moveInBook(b, 1, 0);
  assert.deepEqual(Object.fromEntries(pageSides(b)), {
    "page-1": "right",
    "page-2": "left",
    "page-3": "right",
  });
});
