import assert from "node:assert/strict";
import { test } from "node:test";
import {
  nameCounts,
  prefixNote,
  stripLensPrefix,
  withLensPrefix,
  withStrippedLens,
} from "@/lib/photo-book-lenses";

test("a book's captions write a lens without its prefix, only when it starts with it", () => {
  const prefixes = [{ lens: "Fujinon XF35mmF2", prefix: "Fujinon" }];
  assert.equal(stripLensPrefix("Fujinon XF35mmF2", prefixes), "XF35mmF2");
  assert.equal(stripLensPrefix("XF18mm", prefixes), "XF18mm");
  assert.equal(
    stripLensPrefix("Fujinon XF35mmF2", [{ lens: "Fujinon XF35mmF2", prefix: "Sony" }]),
    "Fujinon XF35mmF2",
  );
  assert.equal(stripLensPrefix("Fujinon XF35mmF2", undefined), "Fujinon XF35mmF2");
});

test("a lens's prefix is set, replaced or taken off, and lenses are counted", () => {
  const one = withLensPrefix(undefined, "A", "x");
  assert.deepEqual(withLensPrefix(one, "A", "y"), [{ lens: "A", prefix: "y" }]);
  assert.deepEqual(withLensPrefix(one, "A", ""), []);
  assert.deepEqual(nameCounts(["B", "A", "B", ""]), [
    { name: "B", count: 2 },
    { name: "A", count: 1 },
  ]);
});

test("a photo's lens is written without its prefix, and the Info tab says how", () => {
  const prefixes = [{ lens: "Fujinon XF35mmF2", prefix: "Fujinon" }];
  assert.deepEqual(withStrippedLens({ lens: "Fujinon XF35mmF2", iso: 200 }, prefixes), {
    lens: "XF35mmF2",
    iso: 200,
  });
  assert.deepEqual(withStrippedLens({ iso: 200 }, prefixes), { iso: 200 });
  assert.equal(prefixNote("Fujinon XF35mmF2", prefixes), "Captions say XF35mmF2");
  assert.equal(prefixNote("XF18mm", prefixes), "Written as it is");
  assert.equal(
    prefixNote("XF18mm", [{ lens: "XF18mm", prefix: "Sony" }]),
    "Doesn't start with that",
  );
});
