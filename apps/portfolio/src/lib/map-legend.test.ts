import assert from "node:assert/strict";
import { test } from "node:test";
import { legendItems, RIDE_COLOR } from "@/lib/map-legend";
import type { TripMapFeature } from "@/lib/trip-lines-map";

/** A train hop's line on the map, with whatever line it names. */
function train(properties: Partial<TripMapFeature["properties"]>): TripMapFeature {
  return {
    type: "Feature",
    geometry: { type: "LineString", coordinates: [] },
    properties: { day: "2026-09-23", mode: "train", ...properties },
  };
}

test("a ride on a line with no color of its own is a ride, not a dashed hop", () => {
  const trips = { type: "FeatureCollection" as const, features: [train({ line: "北松江線" })] };
  const items = legendItems([], trips, false);
  assert.deepEqual(items.rides, [RIDE_COLOR]);
  assert.equal(items.hop, false);
});

test("a hop with no line picked stays a dashed hop", () => {
  const trips = {
    type: "FeatureCollection" as const,
    features: [train({}), train({ colour: "#e5171f" })],
  };
  const items = legendItems([], trips, false);
  assert.deepEqual(items.rides, ["#e5171f"]);
  assert.equal(items.hop, true);
});
