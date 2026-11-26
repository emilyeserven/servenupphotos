import assert from "node:assert/strict";
import { test } from "node:test";
import type { PhotoBook } from "@/lib/photo-book";
import { addGeneratedPage, changeGenerated } from "@/lib/photo-book-generated";
import { generatedPageCount, generatedPart } from "@/lib/photo-book-generated-pages";
import { bookUnits, pageNumbers } from "@/lib/photo-book-order";

const book: PhotoBook = {
  id: "korea",
  name: "Korea",
  template: "",
  pages: [{ id: "page-1", layout: "full", title: null, slots: [{ photo: "", caption: null }] }],
};

test("a generated page runs on across its pages, linked into one unit in the book", () => {
  const added = changeGenerated(addGeneratedPage(book, "places-index"), "page-2", (g) => ({
    ...g,
    pages: 3,
  }));
  const unit = bookUnits(added).find((u) => u.id === "page-2");
  assert.deepEqual(
    unit?.pages.map((p) => p.id),
    ["page-2", "page-2~part-2", "page-2~part-3"],
  );
  assert.deepEqual(unit?.pages.map(generatedPart), [0, 1, 2]);
  // Page 1 is a photo page; the index runs on from page 2 with no blank page before it.
  assert.deepEqual(
    [...pageNumbers(added)],
    [
      ["page-1", 1],
      ["page-2", 2],
      ["page-2~part-2", 3],
      ["page-2~part-3", 4],
    ],
  );
  assert.equal(generatedPageCount({ generated: { kind: "places-index", pages: 0 } }), 1);
});
