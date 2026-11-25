import assert from "node:assert/strict";
import { test } from "node:test";
import { placePhoto } from "@/lib/photo-book";
import { lowResolution, pageWidthInches, photoPixels, printDpi } from "@/lib/photo-book-dpi";
import { addPage, addToBook } from "@/lib/photo-book-order";

test("a page's printed width is in inches, and a page in pixels has none", () => {
  assert.equal(pageWidthInches({}), 12.5);
  assert.equal(pageWidthInches({ size: { width: 25.4, height: 20, unit: "cm" } }), 10);
  assert.equal(pageWidthInches({ size: { width: 720, height: 500, unit: "pt" } }), 10);
  assert.equal(pageWidthInches({ size: { width: 3000, height: 2000, unit: "px" } }), null);
});

test("a photo's resolution is its pixels over the inches it covers once cropped to fill its place", () => {
  // A 3000 px wide photo filling a whole 10 in page prints at 300 dpi.
  const photo = { width: 3000, height: 2000 };
  assert.equal(printDpi(photo, { width: 500, height: 333.3 }, 500, 10), 300);
  // Half the page wide: twice the dpi.
  assert.equal(printDpi(photo, { width: 250, height: 166.6 }, 500, 10), 600);
  // A square place crops the sides: its height sets the scale, so the photo prints wider than the place.
  assert.equal(printDpi(photo, { width: 250, height: 250 }, 500, 10), 400);
  assert.equal(printDpi(photo, { width: 0, height: 0 }, 500, 10), null);
});

test("the photo's pixel size comes from its JSON", () => {
  assert.deepEqual(photoPixels({ width: 4000, height: 3000 }), { width: 4000, height: 3000 });
  assert.equal(photoPixels({ width: "4000" }), null);
  assert.equal(photoPixels(null), null);
});

test("the book's low-resolution photos are its measured places under 300 dpi still holding the photo measured", () => {
  let b = addPage(addPage({ id: "b", name: "B", template: "", pages: [] }, "full"), "full");
  b = placePhoto(placePhoto(b, { page: 0, slot: 0 }, "a.json"), { page: 1, slot: 0 }, "b.json");
  b = addToBook(addToBook(b, "page-2"), "page-1");
  const places = new Map([
    ["page-1:0", { photo: "a.json", dpi: 180 }],
    ["page-2:0", { photo: "b.json", dpi: 320 }],
  ]);
  assert.deepEqual(
    lowResolution(b, places).map(({ unit, number, photo, dpi }) => ({ unit, number, photo, dpi })),
    [{ unit: "page-1", number: 2, photo: "a.json", dpi: 180 }],
  );
  places.set("page-1:0", { photo: "other.json", dpi: 100 });
  assert.deepEqual(lowResolution(b, places), []);
});
