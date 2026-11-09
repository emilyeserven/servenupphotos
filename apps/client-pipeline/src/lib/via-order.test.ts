import assert from "node:assert/strict";
import { test } from "node:test";
import type { TripSegment } from "@/api/trip-lines";
import type { GapDraft } from "@/lib/trip-gaps";
import { canMove, movedInRoute, photoAfter, viasInRouteOrder } from "@/lib/via-order";

const p = (n: number) => ({ latitude: n, longitude: n });
const line = { id: 1, name: "Bus 30" };
const segments: TripSegment[] = [
  { mode: "walk", photos: [1, 2] },
  { mode: "bus", photos: [2, 3], line, board: p(20), alight: p(30) },
  { mode: "walk", photos: [3, 4] },
];

test("a lone via point moves past a photo onto the walk from the bus stop", () => {
  const draft: GapDraft = { gaps: [], via: { "3": [p(1)] } };
  const [via] = viasInRouteOrder(draft, segments);
  assert.ok(canMove(draft, segments, via!, -1));
  assert.equal(canMove(draft, segments, via!, 1), false);
  const moved = movedInRoute(draft, segments, via!, -1);
  assert.deepEqual(moved.via, { "3": [], "alight:2": [p(1)] });
});

test("a via point steps within its stretch before leaving it", () => {
  const draft: GapDraft = { gaps: [], via: { "board:2": [p(1), p(2)] } };
  const [first, second] = viasInRouteOrder(draft, segments);
  assert.deepEqual(movedInRoute(draft, segments, first!, 1).via, { "board:2": [p(2), p(1)] });
  assert.deepEqual(movedInRoute(draft, segments, first!, -1).via, {
    "board:2": [p(2)],
    "1": [p(1)],
  });
  assert.deepEqual(movedInRoute(draft, segments, second!, 1).via, {
    "board:2": [p(1)],
    "alight:2": [p(2)],
  });
});

test("orders via points as the route reaches them, walks to and from stations included", () => {
  const draft: GapDraft = { gaps: [], via: { "3": [p(4)], "alight:2": [p(3)], "1": [p(1)] } };
  const keys = viasInRouteOrder(draft, segments).map((v) => v.key);
  assert.deepEqual(keys, ["1", "alight:2", "3"]);
});

test("finds the photo each via point's stretch leads to, for the photo strip", () => {
  const ids = [1, 2, 3, 4];
  assert.equal(photoAfter("start", ids, segments), 1);
  assert.equal(photoAfter("1", ids, segments), 2);
  assert.equal(photoAfter("board:2", ids, segments), 3);
  assert.equal(photoAfter("alight:2", ids, segments), 3);
  assert.equal(photoAfter("4", ids, segments), undefined);
});
