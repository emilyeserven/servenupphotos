import assert from "node:assert/strict";
import { test } from "node:test";
import { count } from "@portfolio/lib/words";

test("count says one in the singular and every other number in the plural", () => {
  assert.equal(count(1, "photo"), "1 photo");
  assert.equal(count(0, "photo"), "0 photos");
  assert.equal(count(2, "photo"), "2 photos");
});

test("count takes a plural that isn't the noun with an s", () => {
  assert.equal(count(1, "person", "people"), "1 person");
  assert.equal(count(3, "person", "people"), "3 people");
  assert.equal(count(2, "resized copy", "resized copies"), "2 resized copies");
});

test("count writes thousands with a comma", () => {
  assert.equal(count(1204, "photo"), "1,204 photos");
});
