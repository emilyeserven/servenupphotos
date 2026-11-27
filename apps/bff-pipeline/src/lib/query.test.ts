import assert from "node:assert/strict";
import { test } from "node:test";
import { firstParam, goFixed, pathEscape, queryEscape, sortedQuery } from "./query.js";

test("writes decimals as Go's %f does, a tie to the even digit", () => {
  assert.equal(goFixed(-0.125, 2), "-0.12");
  assert.equal(goFixed(0.375, 2), "0.38");
  assert.equal(goFixed(19.5, 0), "20");
  assert.equal(goFixed(2.5, 0), "2");
  assert.equal(goFixed(34.6937, 2), "34.69");
  assert.equal(goFixed(135.5023, 6), "135.502300");
  assert.equal(goFixed(-0.001, 2), "-0.00");
  assert.equal(goFixed(-0, 6), "-0.000000");
});

test("escapes queries and paths as Go does", () => {
  assert.equal(queryEscape("a b;~*:,"), "a+b%3B~%2A%3A%2C");
  assert.equal(
    pathEscape("OpenStreetMap's Overpass servers, asked live"),
    "OpenStreetMap%27s%20Overpass%20servers%2C%20asked%20live",
  );
  assert.equal(
    sortedQuery([
      ["q", "Shin Ōsaka"],
      ["osm_tag", "a:b"],
      ["lang", "en"],
      ["osm_tag", "c"],
    ]),
    "lang=en&osm_tag=a%3Ab&osm_tag=c&q=Shin+%C5%8Csaka",
  );
});

test("reads the first value of a query parameter", () => {
  assert.equal(firstParam({ mode: ["bus", "train"] }, "mode"), "bus");
  assert.equal(firstParam({}, "mode"), "");
});
