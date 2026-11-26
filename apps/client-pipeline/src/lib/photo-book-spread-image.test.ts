import assert from "node:assert/strict";
import { test } from "node:test";
import { spreadImageName, viewPageRange } from "@/lib/photo-book-spread-image";

test("viewPageRange gives page 1 alone, then pairs, then the last page alone", () => {
  assert.deepEqual(viewPageRange(0, 12), { first: 1, last: 1 });
  assert.deepEqual(viewPageRange(2, 12), { first: 4, last: 5 });
  assert.deepEqual(viewPageRange(6, 12), { first: 12, last: 12 });
});

test("spreadImageName names the pages the image shows", () => {
  assert.equal(spreadImageName("korea-2026", 2, 12), "korea-2026-pages-4-5.webp");
  assert.equal(spreadImageName("korea-2026", 0, 12), "korea-2026-page-1.webp");
});
