import assert from "node:assert/strict";
import { test } from "node:test";
import { type PhotoBook, placePhoto } from "@/lib/photo-book";
import { listedPages, photoCount } from "@/lib/photo-book-list";
import { addOtherPage, addPage, addToBook, setLinkNext, unitsInBook } from "@/lib/photo-book-order";

/** A book with page-1 and page-2 as a spread, then page-3 on its own, then an other page. */
function book(): PhotoBook {
  let b: PhotoBook = { id: "b", name: "B", template: "", pages: [] };
  for (let i = 0; i < 3; i += 1) b = addPage(b, "full");
  b = ["page-1", "page-3"].reduce((x, id) => addToBook(x, id), setLinkNext(b, "page-1", true));
  return addOtherPage(placePhoto(b, { page: 0, slot: 0 }, "a.json"), "Bio");
}

test("pages are listed in printed order, a spread's blank page skipped but counted", () => {
  const listed = listedPages(unitsInBook(book()));
  assert.deepEqual(
    listed.map(({ number, page }) => [number, page.id]),
    [
      [2, "page-1"],
      [3, "page-2"],
      [4, "page-3"],
      [5, "page-4"],
    ],
  );
});

test("only places with a photo are counted, never an other page", () => {
  assert.equal(photoCount(listedPages(unitsInBook(book()))), 1);
});
