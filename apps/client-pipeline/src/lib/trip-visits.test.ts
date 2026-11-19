import assert from "node:assert/strict";
import { test } from "node:test";
import type { TripVisit } from "@/api/trip-lines";
import type { GapDraft } from "@/lib/trip-gaps";
import {
  againVisit,
  firstStops,
  firstVisit,
  hasStopNames,
  movedVisit,
  offRoute,
  visitsAfter,
} from "@/lib/trip-visits";

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

test("a trip stop off the route can be put before the first photo", () => {
  const off = omitAfter(lunch);
  const draft = firstVisit({ gaps: [], visits: [off] }, off);
  assert.deepEqual(draft.visits, [{ ...off, first: true }]);
});

function omitAfter({ after: _after, ...rest }: TripVisit): TripVisit {
  return rest;
}

test("visits a place again as a copy off the route, without the first visit's photos", () => {
  const station = {
    name: "Matsue",
    kind: "station" as const,
    latitude: 35.464,
    longitude: 133.0639,
    note: "Changed trains",
    after: 12,
    photos: [40],
  };
  assert.deepEqual(againVisit(station), {
    name: "Matsue",
    kind: "station",
    latitude: 35.464,
    longitude: 133.0639,
    note: "Changed trains",
  });
});

test("a trip stop moves past another at the same place before moving on a photo", () => {
  const a = { ...omitAfter(lunch), name: "A", first: true };
  const b = { ...omitAfter(lunch), name: "B", first: true };
  const draft: GapDraft = { gaps: [], visits: [a, b] };
  const swappedDraft = movedVisit(draft, b, ids, -1);
  assert.deepEqual(swappedDraft.visits, [b, a]);
  assert.equal(movedVisit(swappedDraft, b, ids, -1), swappedDraft);
});

test("a trip stop moved a photo lands next to the stops already there", () => {
  const a = { ...lunch, name: "A" };
  const b = { ...lunch, name: "B" };
  const c = { ...lunch, name: "C", after: 2 };
  const back = movedVisit({ gaps: [], visits: [a, b, c] }, c, ids, -1);
  assert.deepEqual(
    back.visits?.map((v) => v.name),
    ["A", "B", "C"],
  );
  const on = movedVisit({ gaps: [], visits: [c, a, b] }, b, ids, 1);
  assert.deepEqual(
    on.visits?.map((v) => [v.name, v.after]),
    [
      ["B", 2],
      ["C", 2],
      ["A", 1],
    ],
  );
});

test("a stop has localized names once any is written, and a second visit keeps them", () => {
  assert.equal(hasStopNames(lunch), false);
  assert.equal(hasStopNames({ ...lunch, romanization: "  " }), false);
  const named = { ...lunch, localScript: "一蘭" };
  assert.equal(hasStopNames(named), true);
  assert.equal(againVisit(named).localScript, "一蘭");
});
