import assert from "node:assert/strict";
import { test } from "node:test";
import {
  marginPadding,
  marginsApart,
  mirrorMargins,
  pageMargins,
  setMarginsApart,
} from "@/lib/photo-book-margins";

test("a layout's margin goes all round until its left or right margin is set", () => {
  assert.equal(marginsApart({ margin: 4 }), false);
  assert.deepEqual(pageMargins({ margin: 4 }), { top: 4, right: 4, bottom: 4, left: 4 });
  assert.equal(marginPadding({ margin: 4 }), "4cqw 4cqw 4cqw 4cqw");
  assert.equal(marginsApart({ margin: 4, marginLeft: 8 }), true);
  assert.deepEqual(pageMargins({ margin: 4, marginLeft: 8 }), {
    top: 4,
    right: 4,
    bottom: 4,
    left: 8,
  });
  assert.equal(marginPadding({ margin: 4, marginLeft: 8, marginRight: 0 }), "4cqw 0cqw 4cqw 8cqw");
});

test("setting the margins apart starts both sides at the margin, and putting them back clears them", () => {
  assert.deepEqual(setMarginsApart({ margin: 3 }, true), { marginLeft: 3, marginRight: 3 });
  const back = {
    margin: 3,
    marginLeft: 6,
    marginRight: 1,
    ...setMarginsApart({ margin: 3 }, false),
  };
  assert.equal(marginsApart(back), false);
  assert.equal(JSON.stringify(back), '{"margin":3}');
});

test("mirroring a layout swaps its left and right margins", () => {
  assert.deepEqual(mirrorMargins({ margin: 2, marginLeft: 8, marginRight: 1 }), {
    margin: 2,
    marginLeft: 1,
    marginRight: 8,
  });
  assert.deepEqual(mirrorMargins({ margin: 2, marginLeft: 8 }), { margin: 2, marginRight: 8 });
  assert.deepEqual(mirrorMargins({ margin: 2 }), { margin: 2 });
});
