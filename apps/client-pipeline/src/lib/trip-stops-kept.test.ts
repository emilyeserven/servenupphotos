import assert from "node:assert/strict";
import { test } from "node:test";
import type { TripSegment, TripVisit } from "@/api/trip-lines";
import { withStopVias } from "@/lib/trip-stops-kept";

/** A trip stop after photo `after`. */
function visit(after: number | undefined): TripVisit {
  return {
    name: "Stop",
    kind: "food",
    latitude: 5,
    longitude: 6,
    ...(after !== undefined && { after }),
  } as unknown as TripVisit;
}

test("a walk passes through a trip stop after a photo it goes on from", () => {
  const walk = {
    mode: "walk",
    photos: [1, 2, 3],
    via: [{ latitude: 0, longitude: 0 }],
  } as TripSegment;
  assert.deepEqual(withStopVias([walk], [visit(9), visit(2)]), [
    { ...walk, via: [...walk.via!, { after: 2, latitude: 5, longitude: 6, visit: 1 }] },
  ]);
});

test("a stop after a walk's last photo, off the route, or on a hop stays a pin", () => {
  const walk = { mode: "walk", photos: [1, 2] } as TripSegment;
  const hop = { mode: "train", photos: [1, 2] } as TripSegment;
  const visits = [visit(2), visit(undefined)];
  assert.deepEqual(withStopVias([walk, hop], visits), [walk, hop]);
  assert.deepEqual(withStopVias([walk]), [walk]);
});
