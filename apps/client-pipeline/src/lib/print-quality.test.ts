import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkPrint,
  largestPrint,
  presetOf,
  ratingOf,
  readPrintChoice,
  sizeText,
} from "@/lib/print-quality";

const sixK = { width: 6000, height: 4000 };

describe("ratingOf", () => {
  it("rates 300 and up excellent, 200 good, 150 fair, and anything lower poor", () => {
    assert.equal(ratingOf(300), "excellent");
    assert.equal(ratingOf(299.6), "good");
    assert.equal(ratingOf(200), "good");
    assert.equal(ratingOf(150), "fair");
    assert.equal(ratingOf(149), "poor");
  });
});

describe("checkPrint", () => {
  it("turns the paper to match a landscape photo", () => {
    const check = checkPrint(sixK, { width: 4, height: 6, unit: "in" }, "fill");
    assert.deepEqual(check, {
      ppi: 1000,
      rating: "excellent",
      paper: { width: 6, height: 4 },
      cropped: 0,
      blank: 0,
    });
  });

  it("crops a 3:2 photo to fill 8 × 10, which the short side sets", () => {
    const check = checkPrint(sixK, { width: 8, height: 10, unit: "in" }, "fill");
    assert.equal(check?.ppi, 500);
    // 5000 × 4000 of the 6000 × 4000 pixels are used.
    assert.equal(check?.cropped.toFixed(3), "0.167");
    assert.equal(check?.blank, 0);
  });

  it("fits the whole photo with blank paper around it, which the long side sets", () => {
    const check = checkPrint(sixK, { width: 8, height: 10, unit: "in" }, "fit");
    assert.equal(check?.ppi, 600);
    assert.equal(check?.cropped, 0);
    // 10 × 6.67 in of the 10 × 8 in paper is printed.
    assert.equal(check?.blank.toFixed(3), "0.167");
  });

  it("reads centimeters as inches", () => {
    const check = checkPrint(
      { width: 4961, height: 3508 },
      { width: 29.7, height: 42, unit: "cm" },
      "fill",
    );
    // A3 is 16.5 × 11.7 in, and 4961 × 3508 is A3 at 300 pixels per inch.
    assert.equal(check?.ppi, 300);
    assert.equal(check?.rating, "excellent");
  });

  it("rates a small photo on a big print poor", () => {
    const small = { width: 3000, height: 2000 };
    assert.equal(checkPrint(small, { width: 24, height: 36, unit: "in" }, "fill")?.rating, "poor");
  });

  it("checks nothing without a size", () => {
    assert.equal(checkPrint(sixK, { width: 0, height: 10, unit: "in" }, "fill"), null);
  });
});

describe("largestPrint", () => {
  it("gives the size the photo makes at a resolution, in either unit", () => {
    assert.equal(sizeText(largestPrint(sixK, 300, "in"), "in"), "20 × 13.3 in");
    assert.equal(sizeText(largestPrint(sixK, 300, "cm"), "cm"), "50.8 × 33.9 cm");
  });
});

describe("presetOf", () => {
  it("finds a common size and nothing for a custom one", () => {
    assert.equal(presetOf({ width: 8, height: 10, unit: "in" })?.label, "8 × 10 in");
    assert.equal(presetOf({ width: 9, height: 10, unit: "in" }), undefined);
  });
});

describe("readPrintChoice", () => {
  it("keeps a saved size and fit", () => {
    const saved = { size: { width: 21, height: 29.7, unit: "cm" }, fit: "fit" };
    assert.deepEqual(readPrintChoice(saved), saved);
  });

  it("starts at 8 × 10 in, filled, for nothing saved or something unreadable", () => {
    const start = { size: { width: 8, height: 10, unit: "in" }, fit: "fill" };
    assert.deepEqual(readPrintChoice(undefined), start);
    assert.deepEqual(readPrintChoice({ size: { width: 8, height: 10, unit: "ft" } }), start);
  });
});
