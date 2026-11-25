import assert from "node:assert/strict";
import { test } from "node:test";
import { printCss, printSide, printSize } from "@/lib/photo-book-pdf";

test("the page size is written in the book's own unit, BookWright's large landscape when none is set", () => {
  assert.deepEqual(printSize({ size: { width: 210, height: 297, unit: "mm" } }), {
    width: "210mm",
    height: "297mm",
  });
  assert.deepEqual(printSize({}), { width: "12.5in", height: "10.625in" });
});

test("each sheet of paper is one page of the book, with no margin", () => {
  assert.match(
    printCss({ size: { width: 8, height: 10, unit: "in" } }),
    /@page \{ size: 8in 10in; margin: 0; \}/,
  );
});

test("page 1 is a right page, then they alternate", () => {
  assert.deepEqual([0, 1, 2, 3].map(printSide), ["right", "left", "right", "left"]);
});
