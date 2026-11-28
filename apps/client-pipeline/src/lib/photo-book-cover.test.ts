import assert from "node:assert/strict";
import { test } from "node:test";
import type { PhotoBook } from "@/lib/photo-book";
import {
  DEFAULT_BLURB,
  DEFAULT_COVER,
  SPINE_BAND,
  blurbOf,
  blurbPdfs,
  blurbWarnings,
  coverOf,
  coverWarnings,
  coverParts,
  inches,
  setBlurb,
  setCover,
  validBlurb,
} from "@/lib/photo-book-cover";

const book: PhotoBook = { id: "korea", name: "Korea", template: "", pages: [] };

test("a book's cover starts as Vol. 3's and keeps what was changed", () => {
  assert.deepEqual(coverOf(book), DEFAULT_COVER);
  const changed = setCover(book, { volume: "Vol. 4" });
  assert.equal(coverOf(changed).volume, "Vol. 4");
  assert.equal(coverOf(changed).title, "Serven\nUp\nPhotos");
  assert.equal(coverOf(setCover(changed, { author: "" })).volume, "Vol. 4");
});

test("Blurb's sizes start as the 78-page Large Landscape book's and refuse ones with no room", () => {
  assert.deepEqual(blurbOf(book), DEFAULT_BLURB);
  assert.equal(blurbOf(setBlurb(book, { spine: 0.7 })).spine, 0.7);
  assert.equal(setBlurb(book, { spine: 30 }), book);
  assert.equal(setBlurb(book, { pageWidth: 0 }), book);
  assert.equal(validBlurb({ ...DEFAULT_BLURB, bleed: 0 }), true);
  assert.equal(validBlurb({ ...DEFAULT_BLURB, bleed: -0.1 }), false);
});

test("the cover sheet is the back, the spine, then the front, the front's words inside its trim past the spine band", () => {
  const sizes = { ...DEFAULT_BLURB, coverWidth: 21, coverHeight: 10, spine: 1, bleed: 0.5 };
  const parts = coverParts(sizes);
  assert.deepEqual(parts.back, { left: 0, top: 0, width: (10 / 21) * 100, height: 100 });
  assert.deepEqual(parts.spine, {
    left: (10 / 21) * 100,
    top: 0,
    width: (1 / 21) * 100,
    height: 100,
  });
  assert.deepEqual(parts.front, {
    left: (11 / 21) * 100,
    top: 0,
    width: (10 / 21) * 100,
    height: 100,
  });
  assert.deepEqual(parts.frontTrim, {
    left: (11 / 21) * 100,
    top: 5,
    width: (9.5 / 21) * 100,
    height: 90,
  });
  // The white band covers the spine and SPINE_BAND of the front and back; the words start past it.
  assert.deepEqual(parts.band, {
    left: ((10 - SPINE_BAND) / 21) * 100,
    top: 0,
    width: ((1 + 2 * SPINE_BAND) / 21) * 100,
    height: 100,
  });
  assert.deepEqual(parts.frontWords, {
    left: ((11 + SPINE_BAND) / 21) * 100,
    top: 5,
    width: ((9.5 - SPINE_BAND) / 21) * 100,
    height: 90,
  });
});

test("the warnings say how much Blurb trims, from the book's page size when it's in inches", () => {
  assert.equal(inches(26.681), "26.681 in");
  assert.equal(inches(0.125000001), "0.125 in");
  assert.match(
    blurbWarnings(book)[0] ?? "",
    /about 0\.125 in off the top, bottom and outside edge/,
  );
  assert.match(blurbWarnings(book)[0] ?? "", /0\.306 in off each edge of the cover/);
  const inCm = { size: { width: 30, height: 25, unit: "cm" as const } };
  assert.match(blurbWarnings(inCm)[0] ?? "", /the bleed off the top/);
});

test("PDF for Blurb makes the pages' PDF then the cover's, and the Cover tab's only the cover's", () => {
  const both = blurbPdfs("korea", 24, false, DEFAULT_BLURB);
  assert.deepEqual(
    both.pdfs.map((pdf) => [pdf.draw, pdf.name, pdf.pages, pdf.width, pdf.height]),
    [
      ["pages", "korea-blurb-pages.pdf", 24, 12.625, 10.875],
      ["cover", "korea-blurb-cover.pdf", 1, 26.681, 11.625],
    ],
  );
  assert.equal(both.label, "PDF for Blurb");
  assert.deepEqual(
    blurbPdfs("korea", 24, true, DEFAULT_BLURB).pdfs.map((pdf) => pdf.draw),
    ["cover"],
  );
});

test("the front's words closer to the trim than Blurb's safe boundary are warned about, not moved", () => {
  const warnings = coverWarnings(DEFAULT_BLURB);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0] ?? "", /^The title's top is 0\.121 in from the trimmed edge/);
  assert.equal(coverWarnings({ ...DEFAULT_BLURB, coverWidth: 60, spine: 1 }).length, 0);
});
