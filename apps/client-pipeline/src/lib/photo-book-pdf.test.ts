import assert from "node:assert/strict";
import { test } from "node:test";
import {
  absoluteSrcSet,
  pdfDocument,
  pdfProgressText,
  printCss,
  printSide,
  printSize,
} from "@/lib/photo-book-pdf";

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

test("a srcset's URLs are made whole, keeping their widths", () => {
  assert.equal(
    absoluteSrcSet(
      "/api/small.webp 400w, https://cdn.example.net/large.webp 2400w",
      "http://localhost:5174/photo-books/a/book",
    ),
    "http://localhost:5174/api/small.webp 400w, https://cdn.example.net/large.webp 2400w",
  );
});

test("the printed page holds the style sheets and the pages, with no early end to its styles", () => {
  const html = pdfDocument({
    styles: "p { color: red } /* </style> */",
    pages: '<div id="photo-book-print"></div>',
    base: "http://localhost:5174/",
  });
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<base href="http:\/\/localhost:5174\/">/);
  assert.equal(html.split("</style>").length, 2);
  assert.match(html, /<body style="margin: 0"><div id="photo-book-print"><\/div><\/body>/);
});

/** The backend's progress at step, done of total. */
function at(step: "" | "starting" | "photos" | "printing", done = 0, total = 0) {
  return { running: true, step, done, total };
}

test("Save as PDF says how far the PDF has got", () => {
  assert.equal(pdfProgressText(true, undefined), "Drawing the pages…");
  assert.equal(pdfProgressText(false, undefined), "Making the PDF…");
  assert.equal(pdfProgressText(false, at("starting")), "Starting Chrome…");
  assert.equal(pdfProgressText(false, at("photos", 12, 90)), "Loading photos: 12 of 90");
  assert.equal(pdfProgressText(false, at("printing", 0, 72)), "Printing 72 pages…");
});
