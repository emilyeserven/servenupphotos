import assert from "node:assert/strict";
import { test } from "node:test";
import { MemoCache } from "./memo.js";

test("keeps an answer until it's older than the TTL", () => {
  let now = 0;
  const cache = new MemoCache<string>(1000, 10, () => now);
  cache.put("q", "answer");
  now = 1000;
  assert.equal(cache.get("q"), "answer");
  now = 1001;
  assert.equal(cache.get("q"), undefined);
});

test("drops the oldest answer when full and none have expired", () => {
  let now = 0;
  const cache = new MemoCache<string>(1000, 2, () => now);
  cache.put("a", "1");
  now = 1;
  cache.put("b", "2");
  cache.put("c", "3");
  assert.deepEqual([cache.get("a"), cache.get("b"), cache.get("c")], [undefined, "2", "3"]);
});

test("drops expired answers first when full", () => {
  let now = 0;
  const cache = new MemoCache<string>(10, 2, () => now);
  cache.put("a", "1");
  now = 5;
  cache.put("b", "2");
  now = 12;
  cache.put("c", "3");
  assert.deepEqual([cache.get("a"), cache.get("b"), cache.get("c")], [undefined, "2", "3"]);
});
