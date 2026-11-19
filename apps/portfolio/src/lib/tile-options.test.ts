import assert from "node:assert/strict";
import { test } from "node:test";
import { optionsSearch } from "@portfolio/lib/tile-options";

test("leaves every default out of the URL", () => {
  const search = optionsSearch("square", {
    size: undefined,
    info: false,
    ordered: true,
    bands: false,
    distances: false,
  });
  assert.deepEqual(search, {
    size: undefined,
    info: undefined,
    ordered: undefined,
    bands: undefined,
    distances: undefined,
  });
});

test("keeps info, unordered rows and distance groups and distances when they're set", () => {
  const search = optionsSearch("natural", {
    size: undefined,
    info: true,
    ordered: false,
    bands: true,
    distances: true,
  });
  assert.deepEqual(search, {
    size: undefined,
    info: true,
    ordered: false,
    bands: true,
    distances: true,
  });
});
