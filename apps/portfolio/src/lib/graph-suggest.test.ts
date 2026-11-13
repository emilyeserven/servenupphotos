import assert from "node:assert/strict";
import { test } from "node:test";
import { suggestedType, type SuggestAxes, typeFits } from "@portfolio/lib/graph-suggest";

/** Each type's fit alone, without the reasons. */
function fitsOf(axes: SuggestAxes) {
  return Object.fromEntries(Object.entries(typeFits(axes)).map(([type, { fit }]) => [type, fit]));
}

test("Year suits a line best, then bars, and not a pie", () => {
  const fits = fitsOf({ x: "year", xCount: 9 });
  assert.equal(fits.line, "best");
  assert.equal(fits.bar, "good");
  assert.equal(fits.pie, "poor");
  assert.equal(suggestedType(typeFits({ x: "year", xCount: 9 })), "line");
});

test("other times suit bars best, then a line", () => {
  const fits = fitsOf({ x: "month", xCount: 12 });
  assert.equal(fits.bar, "best");
  assert.equal(fits.line, "good");
  assert.equal(fits.pie, "poor");
  assert.match(typeFits({ x: "season", xCount: 4 }).pie.reason, /order/);
});

test("a camera setting suits photo dots best", () => {
  for (const x of [
    "aperture",
    "aperture-ranges",
    "exposure",
    "iso",
    "iso-ranges",
    "focalLength",
    "focal-length",
    "lightness",
  ]) {
    const fits = fitsOf({ x, xCount: 10 });
    assert.deepEqual(
      [fits.photos, fits.bar, fits.line, fits.pie],
      ["best", "good", "good", "poor"],
    );
  }
});

test("a category suits bars best, a pie only with 8 or fewer values, and never a line", () => {
  const few = fitsOf({ x: "countries", xCount: 8 });
  assert.deepEqual([few.bar, few.pie, few.line], ["best", "good", "poor"]);
  const many = typeFits({ x: "countries", xCount: 9 });
  assert.equal(many.pie.fit, "poor");
  assert.match(many.pie.reason, /Other/);
});

test("an unknown stat, a main color or an orientation counts as a category", () => {
  for (const x of ["something-new", "mainColor", "orientation"]) {
    assert.equal(suggestedType(typeFits({ x, xCount: 3 })), "bar");
    assert.equal(typeFits({ x, xCount: 3 }).pie.fit, "good");
  }
});

test("a stat where a photo can be in several rows makes a pie poor", () => {
  for (const x of ["lens-brands", "cameras-1", "genre", "tags"]) {
    const pie = typeFits({ x, xCount: 3 }).pie;
    assert.equal(pie.fit, "poor");
    assert.match(pie.reason, /100%/);
  }
  assert.equal(typeFits({ x: "cameras-0", xCount: 3 }).pie.fit, "good");
});

test("two stats with an order suit a heatmap best, and outrank the one-stat types", () => {
  const fits = fitsOf({ x: "month", y: "year", xCount: 12 });
  assert.deepEqual([fits.heatmap, fits.scatter, fits.bar], ["best", "good", "good"]);
  assert.equal(suggestedType(typeFits({ x: "month", y: "year", xCount: 12 })), "heatmap");
});

test("two stats where one is a category suit a heatmap or scatterplot alike", () => {
  const fits = fitsOf({ x: "countries", y: "season", xCount: 5 });
  assert.deepEqual([fits.heatmap, fits.scatter], ["good", "good"]);
  assert.equal(suggestedType(typeFits({ x: "countries", y: "season", xCount: 5 })), undefined);
});

test("without a second stat, the two-stat types are good and say they compare two stats", () => {
  const fits = typeFits({ x: "year", xCount: 9 });
  assert.equal(fits.heatmap.fit, "good");
  assert.match(fits.scatter.reason, /two stats/);
});
