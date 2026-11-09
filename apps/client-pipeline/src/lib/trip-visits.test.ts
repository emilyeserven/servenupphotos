import assert from "node:assert/strict";
import { test } from "node:test";
import type { TripVisit } from "@/api/trip-lines";
import type { GapDraft } from "@/lib/trip-gaps";
import { firstStops, movedVisit, offRoute } from "@/lib/trip-visits";

const lunch: TripVisit = { name: "Lunch", kind: "restaurant", latitude: 1, longitude: 1, after: 1 };
const ids = [1, 2, 3];

test("a trip stop after the first photo moves to before it, and back", () => {
  const draft: GapDraft = { gaps: [], visits: [lunch] };
  const before = movedVisit(draft, lunch, ids, -1);
  assert.deepEqual(before.visits, [{ ...omitAfter(lunch), first: true }]);
  assert.deepEqual(firstStops(before.visits), before.visits);
  assert.deepEqual(offRoute(before.visits), []);
  const back = movedVisit(before, before.visits![0]!, ids, 1);
  assert.deepEqual(back.visits, [lunch]);
});

test("a trip stop before the first photo goes no earlier", () => {
  const first = { ...omitAfter(lunch), first: true };
  const draft: GapDraft = { gaps: [], visits: [first] };
  assert.equal(movedVisit(draft, first, ids, -1), draft);
});

function omitAfter({ after: _after, ...rest }: TripVisit): TripVisit {
  return rest;
}
