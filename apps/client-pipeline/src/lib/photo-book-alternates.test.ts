import assert from "node:assert/strict";
import { test } from "node:test";
import type { PhotoBook } from "@/lib/photo-book";
import {
  alternateLetters,
  alternatesLabel,
  alternatesOf,
  groupMembers,
  isHidden,
  leaveAlternates,
  markAlternate,
  pickAlternate,
  showAlternates,
} from "@/lib/photo-book-alternates";
import { addPage, addToBook, bookOrder, bookUnits, setLinkNext } from "@/lib/photo-book-order";

/** A book with four full pages, page-1 and page-2 in it. */
const book = (): PhotoBook => {
  let b: PhotoBook = { id: "b", name: "B", template: "", pages: [] };
  for (let i = 0; i < 4; i++) b = addPage(b, "full");
  return addToBook(addToBook(b, "page-1"), "page-2");
};

/** Each unit's ID, group and whether it's hidden. */
const groups = (b: PhotoBook) =>
  bookUnits(b).map((u) => [u.id, alternatesOf(u) ?? null, isHidden(u)]);

test("pages marked as alternates share a group, which a third joins and others can merge into", () => {
  let b = markAlternate(book(), "page-2", "page-3");
  assert.deepEqual(groups(b), [
    ["page-1", null, false],
    ["page-2", "alt-1", false],
    ["page-3", "alt-1", false],
    ["page-4", null, false],
  ]);
  b = markAlternate(b, "page-4", "page-2");
  assert.equal(alternatesOf(bookUnits(b)[3]!), "alt-1");
  assert.deepEqual([...alternateLetters(b)], [["alt-1", "A"]]);
  assert.equal(alternatesLabel(b, bookUnits(b)[1]!), "Alternate A");
  assert.equal(alternatesLabel(b, bookUnits(b)[0]!), "Alternates");
  assert.equal(groupMembers(b, bookUnits(b)[1]!).length, 3);
  assert.deepEqual(groupMembers(b, bookUnits(b)[0]!), []);
  assert.equal(markAlternate(b, "page-1", "page-1"), b);
});

test("picking an alternate hides the others and takes their place in the book", () => {
  let b = markAlternate(markAlternate(book(), "page-2", "page-3"), "page-2", "page-4");
  b = pickAlternate(b, "page-3");
  assert.deepEqual(groups(b), [
    ["page-1", null, false],
    ["page-2", "alt-1", true],
    ["page-3", "alt-1", false],
    ["page-4", "alt-1", true],
  ]);
  assert.deepEqual(bookOrder(b), ["page-1", "page-3"]);
  assert.equal(alternatesLabel(b, bookUnits(b)[1]!), "Alternate A · hidden");
  b = showAlternates(b, "alt-1");
  assert.ok(bookUnits(b).every((u) => !isHidden(u)));
  assert.equal(b.pages.length, 4);
});

test("a spread is an alternate as one, and a group left with one page or spread ends", () => {
  let b = setLinkNext(book(), "page-3", true);
  b = markAlternate(b, "page-3", "page-1");
  assert.deepEqual(
    b.pages.map((p) => p.alternates ?? null),
    ["alt-1", null, "alt-1", "alt-1"],
  );
  b = leaveAlternates(pickAlternate(b, "page-1"), "page-3");
  assert.ok(b.pages.every((p) => p.alternates === undefined && p.hidden === undefined));
});
