import assert from "node:assert/strict";
import { test } from "node:test";
import { lookupSource } from "@/lib/lookup-source";

test("a bus or ferry is looked up on OpenStreetMap while a rail map is picked", () => {
  assert.equal(lookupSource("mlit", "bus"), "overpass");
  assert.equal(lookupSource("osmrail", "ferry"), "overpass");
  assert.equal(lookupSource("mlit", "train"), "mlit");
  assert.equal(lookupSource("transitland", "bus"), "transitland");
  assert.equal(lookupSource("mlit", undefined), "mlit");
});
