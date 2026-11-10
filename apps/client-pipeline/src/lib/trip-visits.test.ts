import assert from "node:assert/strict";
import { test } from "node:test";
import type { TripVisit } from "@/api/trip-lines";
import type { GapDraft } from "@/lib/trip-gaps";
import { firstStops, movedVisit, offRoute, visitsAfter } from "@/lib/trip-visits";

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

test("a trip stop moves on to after the last photo, where the route ends, and no further", () => {
  const draft: GapDraft = { gaps: [], visits: [{ ...lunch, after: 2 }] };
  const last = movedVisit(draft, draft.visits![0]!, ids, 1);
  assert.deepEqual(last.visits, [{ ...lunch, after: 3 }]);
  assert.deepEqual(visitsAfter(last.visits, 3), last.visits);
  assert.equal(movedVisit(last, last.visits![0]!, ids, 1), last);
});

function omitAfter({ after: _after, ...rest }: TripVisit): TripVisit {
  return rest;
}
