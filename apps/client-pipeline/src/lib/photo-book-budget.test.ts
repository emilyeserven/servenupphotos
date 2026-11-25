import assert from "node:assert/strict";
import { test } from "node:test";
import type { PhotoBook } from "@/lib/photo-book";
import { budgetMeterParts, budgetStatus, budgetText, readBudget } from "@/lib/photo-book-budget";
import { addOtherPage, addPage, addToBook, setLinkNext } from "@/lib/photo-book-order";

/** A book with a spread and a page in it, a page out of it, and an other page in it: 4 placed. */
const book = (budget?: PhotoBook["budget"]): PhotoBook => {
  let b: PhotoBook = { id: "b", name: "B", template: "", pages: [], budget };
  for (let i = 0; i < 4; i++) b = addPage(b, "full");
  b = setLinkNext(b, "page-1", true);
  b = addToBook(addToBook(b, "page-1"), "page-3");
  b = addOtherPage(b, "Bio");
  return addToBook(b, b.pages.at(-1)!.id);
};

test("the pages placed count a spread as two and other pages, against the target and max", () => {
  assert.equal(budgetStatus(book()), null);
  assert.equal(budgetStatus(book({})), null);
  assert.deepEqual(budgetStatus(book({ target: 6, max: 8 })), {
    placed: 4,
    target: 6,
    max: 8,
    state: "under",
  });
  assert.equal(budgetStatus(book({ target: 4 }))?.state, "reached");
  assert.equal(budgetStatus(book({ max: 4 }))?.state, "under");
  assert.equal(budgetStatus(book({ target: 2, max: 3 }))?.state, "over-max");
});

test("the Info tab's boxes become a budget, leaving out empty ones and refusing bad ones", () => {
  assert.deepEqual(readBudget("40", "60"), { target: 40, max: 60 });
  assert.deepEqual(readBudget("", "60"), { max: 60 });
  assert.deepEqual(readBudget("40", "0"), { target: 40 });
  assert.equal(readBudget(" ", ""), undefined);
  assert.equal(readBudget("60", "40"), "Make the target no more than the max.");
  assert.match(String(readBudget("4.5", "")), /whole numbers/);
  assert.match(String(readBudget("", "-1")), /whole numbers/);
});

test("the Book tab's words and bar say how far the count is from each number", () => {
  assert.deepEqual(budgetMeterParts({ placed: 34, target: 40, max: 60, state: "under" }), {
    gaps: ["6 to the target (40)", "26 to the max (60)"],
    fill: 34 / 60,
    tick: 40 / 60,
    overMax: 0,
  });
  assert.deepEqual(budgetMeterParts({ placed: 62, target: null, max: 60, state: "over-max" }), {
    gaps: ["2 past the max (60)"],
    fill: 1,
    tick: null,
    overMax: 2,
  });
  assert.deepEqual(budgetMeterParts({ placed: 40, target: 40, max: null, state: "reached" }).gaps, [
    "At the target (40)",
  ]);
  assert.deepEqual(budgetText({ max: 60 }), { target: "", max: "60" });
  assert.deepEqual(budgetText(undefined), { target: "", max: "" });
});
