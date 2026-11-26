import assert from "node:assert/strict";
import { test } from "node:test";
import {
  entrySize,
  entryTextStyle,
  fitScale,
  tidyEntrySizes,
  withEntrySize,
} from "@/lib/photo-book-entry-sizes";

test("an entry's own size is 100 until set, from 50 to 100 in steps of 5", () => {
  assert.equal(entrySize({}, "city:Hagi"), 100);
  assert.equal(entrySize({ entrySizes: { "city:Hagi": 87 } }, "city:Hagi"), 85);
  assert.equal(entrySize({ entrySizes: { "city:Hagi": 10 } }, "city:Hagi"), 50);
  assert.equal(entrySize({ entrySizes: { "city:Hagi": 300 } }, "city:Hagi"), 100);
});

test("setting an entry's size keeps the others and leaves out those at 100", () => {
  const one = withEntrySize(undefined, "place:okuhagi", 95);
  assert.deepEqual(one, { "place:okuhagi": 95 });
  assert.deepEqual(withEntrySize(one, "city:Hagi", 90), { "place:okuhagi": 95, "city:Hagi": 90 });
  assert.equal(withEntrySize(one, "place:okuhagi", 100), undefined);
  assert.equal(tidyEntrySizes({}), undefined);
});

test("a line shrinks to fit its column only by a little, and wraps otherwise", () => {
  assert.equal(fitScale(90, 100), 1);
  assert.equal(fitScale(105, 100), 0.952);
  assert.equal(fitScale(150, 100), null);
  assert.equal(fitScale(0, 100), 1);
});

test("an entry's text takes its size and fit, kept on one line only while shrunk to fit", () => {
  assert.deepEqual(entryTextStyle(1, 1), {});
  assert.deepEqual(entryTextStyle(0.9, null), { fontSize: "0.9em" });
  assert.deepEqual(entryTextStyle(1, 0.95), { fontSize: "0.95em", whiteSpace: "nowrap" });
});
