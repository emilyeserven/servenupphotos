import assert from "node:assert/strict";
import { test } from "node:test";
import type { PhotoBook } from "@/lib/photo-book";
import { refreshCaptions, typedCaptionCount } from "@/lib/photo-book-captions";

/** A book with a typed caption, a template one, and a typed one on an empty place. */
const book: PhotoBook = {
  id: "b",
  name: "B",
  template: "",
  pages: [
    { id: "p1", layout: "full", title: null, slots: [{ photo: "a", caption: "Typed" }] },
    {
      id: "p2",
      layout: "pair-left",
      title: null,
      slots: [
        { photo: "b", caption: null },
        { photo: "", caption: "Note" },
      ],
    },
  ],
};

test("refreshing captions fills typed ones from the template and keeps an empty place's", () => {
  assert.equal(typedCaptionCount(book), 1);
  const refreshed = refreshCaptions(book);
  assert.deepEqual(refreshed.pages[0]!.slots, [{ photo: "a", caption: null }]);
  assert.equal(refreshed.pages[1], book.pages[1]);
  assert.equal(typedCaptionCount(refreshed), 0);
});
