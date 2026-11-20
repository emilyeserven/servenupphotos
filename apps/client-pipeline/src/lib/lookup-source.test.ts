import assert from "node:assert/strict";
import { test } from "node:test";
import { lookupSource } from "@/lib/lookup-source";

test("a bus is looked up on the bus map and a ferry on OpenStreetMap while a rail map is picked", () => {
  assert.equal(lookupSource("mlit", "bus"), "osmbus");
  assert.equal(lookupSource("osmrail", "bus"), "osmbus");
  assert.equal(lookupSource("osmrail", "ferry"), "overpass");
  assert.equal(lookupSource("mlit", "train"), "mlit");
  assert.equal(lookupSource("transitland", "bus"), "transitland");
  assert.equal(lookupSource("overpass", "bus"), "overpass");
  assert.equal(lookupSource("mlit", undefined), "mlit");
});
