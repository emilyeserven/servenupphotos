import assert from "node:assert/strict";
import { test } from "node:test";
import { clamp, isObject, stringOf, textOf } from "@portfolio/lib/values";

test("tells a plain object from null, an array and text", () => {
  assert.equal(isObject({ x: 1 }), true);
  assert.equal(isObject(null), false);
  assert.equal(isObject([1]), false);
  assert.equal(isObject("x"), false);
});

test("reads text trimmed, or as written, and anything else as empty", () => {
  assert.equal(textOf("  Tokyo \n"), "Tokyo");
  assert.equal(stringOf("  Tokyo \n"), "  Tokyo \n");
  assert.equal(textOf(3), "");
  assert.equal(stringOf(undefined), "");
});

test("keeps a number from low to high", () => {
  assert.equal(clamp(-2, 0, 1), 0);
  assert.equal(clamp(0.5, 0, 1), 0.5);
  assert.equal(clamp(7, 0, 1), 1);
});
