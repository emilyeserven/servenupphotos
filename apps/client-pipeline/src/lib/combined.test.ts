import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalJson } from "@/lib/combined";

test("writes equal data the same whatever its key order", () => {
  assert.equal(
    canonicalJson({ b: 1, a: { d: 2, c: 3 } }),
    canonicalJson({ a: { c: 3, d: 2 }, b: 1 }),
  );
  assert.equal(canonicalJson({ b: 1, a: 2 }), '{"a":2,"b":1}');
});

test("sorts the keys of objects inside lists, and keeps the list's order", () => {
  assert.equal(canonicalJson([{ b: 1, a: 2 }, { z: 0 }]), '[{"a":2,"b":1},{"z":0}]');
  assert.notEqual(canonicalJson([1, 2]), canonicalJson([2, 1]));
});

test("tells different data apart", () => {
  assert.notEqual(canonicalJson({ a: 1 }), canonicalJson({ a: "1" }));
  assert.notEqual(canonicalJson({ a: null }), canonicalJson({}));
});

test("writes plain values as JSON does", () => {
  assert.equal(canonicalJson(null), "null");
  assert.equal(canonicalJson("x"), '"x"');
  assert.equal(canonicalJson(undefined), undefined);
});
