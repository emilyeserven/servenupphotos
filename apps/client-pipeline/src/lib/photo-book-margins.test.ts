import assert from "node:assert/strict";
import { test } from "node:test";
import { marginPadding, mirrorMargins, pageMargins } from "@/lib/photo-book-margins";

test("a layout's margin goes all round, with its print offsets added only when printed for Blurb", () => {
  const look = { margin: 4, printOffsetLeft: 3 };
  assert.deepEqual(pageMargins(look, false), { top: 4, right: 4, bottom: 4, left: 4 });
  assert.deepEqual(pageMargins(look, true), { top: 4, right: 4, bottom: 4, left: 7 });
  assert.equal(marginPadding({ margin: 4 }, true), "4cqw 4cqw 4cqw 4cqw");
  assert.equal(
    marginPadding({ margin: 4, printOffsetLeft: 3, printOffsetRight: 1 }, true),
    "4cqw 5cqw 4cqw 7cqw",
  );
});

test("mirroring a layout swaps its left and right print offsets", () => {
  assert.deepEqual(mirrorMargins({ margin: 2, printOffsetLeft: 8, printOffsetRight: 1 }), {
    margin: 2,
    printOffsetLeft: 1,
    printOffsetRight: 8,
  });
  assert.deepEqual(mirrorMargins({ margin: 2, printOffsetLeft: 8 }), {
    margin: 2,
    printOffsetRight: 8,
  });
  assert.deepEqual(mirrorMargins({ margin: 2 }), { margin: 2 });
});
