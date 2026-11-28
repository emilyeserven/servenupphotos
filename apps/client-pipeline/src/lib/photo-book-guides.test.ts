import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_BLURB } from "@/lib/photo-book-cover";
import { type PageGuides, pageGuides } from "@/lib/photo-book-guides";

/** Rounds each guide to a hundredth of a percent, to compare. */
function rounded(guides: PageGuides) {
  return Object.fromEntries(Object.entries(guides).map(([k, v]) => [k, Math.round(v * 100) / 100]));
}

test("a Large Landscape page's guides are Blurb's 0.125 in bleed and its safe boundary, in percent", () => {
  assert.deepEqual(
    rounded(pageGuides({})),
    rounded({
      top: (0.125 / 10.875) * 100,
      outside: (0.125 / 12.625) * 100,
      safeTop: (0.375 / 10.875) * 100,
      safeOutside: (0.375 / 12.625) * 100,
      safeBinding: (0.5 / 12.625) * 100,
    }),
  );
});

test("the bleed comes from how much larger Blurb's page is than the book's, or 0.125 in without one", () => {
  const cm = pageGuides({ size: { width: 31.75, height: 26.9875, unit: "cm" } });
  assert.ok(Math.abs(cm.outside - (0.125 / 12.625) * 100) < 1e-9);
  const px = pageGuides({ size: { width: 1200, height: 1000, unit: "px" } });
  assert.ok(Math.abs(px.top - (0.125 / 10.875) * 100) < 1e-9);
  const larger = pageGuides({ size: { width: 20, height: 15, unit: "in" }, blurb: DEFAULT_BLURB });
  assert.ok(Math.abs(larger.outside - (0.125 / 12.625) * 100) < 1e-9);
});
