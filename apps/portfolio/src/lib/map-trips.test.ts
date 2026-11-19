import assert from "node:assert/strict";
import { test } from "node:test";
import { mapTrips, NO_TRIP, tripOf, withoutTrips } from "@portfolio/lib/map-trips";
import type { TimelineLabel } from "@portfolio/lib/timeline-labels";
import type { TripLinesMap, TripMapFeature } from "@portfolio/lib/trip-lines-map";

const TRIPS: TimelineLabel[] = [
  { id: "korea", name: "Korea", start: "2026-09-12", end: "2026-10-02" },
  { id: "sf", name: "San Francisco", start: "2026-10-24", end: "2026-10-30" },
];

/** A walk on the day, or a leg of a Trip when `trip` is given. */
function line(day: string, trip?: string): TripMapFeature {
  return {
    type: "Feature",
    geometry: { type: "LineString", coordinates: [] },
    properties: { day, mode: trip ? "train" : "walk", ...(trip && { trip }) },
  };
}

function map(...features: TripMapFeature[]): TripLinesMap {
  return { type: "FeatureCollection", features };
}

test("a line belongs to the Trip covering its day, or its own Trip for a leg", () => {
  assert.equal(tripOf(line("2026-09-20"), TRIPS), "korea");
  assert.equal(tripOf(line("2025-01-19"), TRIPS), NO_TRIP);
  assert.equal(tripOf(line("2026-09-11", "korea"), TRIPS), "korea");
});

test("lists the Trips with lines newest first, then the days in no Trip", () => {
  const trips = mapTrips(
    map(
      line("2025-01-19"),
      line("2026-09-20"),
      line("2026-09-25"),
      line("2026-09-25"),
      line("2026-10-24"),
    ),
    TRIPS,
  );
  assert.deepEqual(trips, [
    { id: "sf", name: "San Francisco", start: "2026-10-24", end: "2026-10-24", days: 1 },
    { id: "korea", name: "Korea", start: "2026-09-20", end: "2026-09-25", days: 2 },
    { id: NO_TRIP, name: "Days in no trip", start: "2025-01-19", end: "2025-01-19", days: 1 },
  ]);
});

test("leaves out the hidden Trips' lines", () => {
  const all = map(line("2025-01-19"), line("2026-09-20"), line("2026-09-21", "korea"));
  assert.equal(withoutTrips(all, [], TRIPS), all);
  assert.deepEqual(withoutTrips(all, ["korea"], TRIPS).features, [line("2025-01-19")]);
  assert.deepEqual(withoutTrips(all, [NO_TRIP], TRIPS).features.length, 2);
});
