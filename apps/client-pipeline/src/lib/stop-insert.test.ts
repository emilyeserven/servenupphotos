import assert from "node:assert/strict";
import { test } from "node:test";
import type { TripVisit } from "@/api/trip-lines";
import {
  insertChoices,
  insertedVisit,
  stopWay,
  withGapKeepingStops,
  withStopWay,
} from "@/lib/stop-insert";
import { type GapDraft, segmentsOf, walkingDraft, withGap } from "@/lib/trip-gaps";

const bottom: TripVisit = { name: "Sanroku", kind: "station", latitude: 1, longitude: 1, after: 1 };
const top: TripVisit = { name: "Sancho", kind: "station", latitude: 2, longitude: 2, after: 1 };
const cafe: TripVisit = { name: "Café", kind: "cafe", latitude: 3, longitude: 3 };

test("the way between two trip stops is its own, so a ropeway can run between two stations", () => {
  const draft: GapDraft = { ...withGap(walkingDraft([1, 2]), 0, "car"), visits: [bottom, top] };
  const ropeway = withStopWay(draft, draft.visits![1]!, "ropeway");
  assert.deepEqual(
    segmentsOf([1, 2], ropeway).map((s) => s.mode),
    ["car", "ropeway", "car"],
  );
});

test("changing the way after the stops keeps the ways to them", () => {
  const draft: GapDraft = { ...withGap(walkingDraft([1, 2]), 0, "car"), visits: [bottom] };
  const walked = withGapKeepingStops(draft, draft.visits!, 0, "walk");
  assert.equal(walked.gaps[0], "walk");
  assert.equal(stopWay(walked.visits![0]!, walked.gaps[0]!), "car");
  assert.deepEqual(
    segmentsOf([1, 2], walked).map((s) => s.mode),
    ["car", "walk"],
  );
});

test("a stop follows the gap's way until it has its own, and has none in a break", () => {
  assert.equal(stopWay(bottom, "bus"), "bus");
  assert.equal(stopWay({ ...bottom, mode: "walk" }, "bus"), "walk");
  assert.equal(stopWay(bottom, "break"), undefined);
  const fromBreak = withGapKeepingStops({ gaps: ["break"], visits: [bottom] }, [bottom], 0, "car");
  assert.equal(fromBreak.visits![0]!.mode, undefined);
});

test("a stop on the route already goes on again as a second visit, the first left where it is", () => {
  const draft: GapDraft = { gaps: ["walk", "walk"], visits: [bottom, cafe] };
  const choices = insertChoices(draft.visits);
  assert.deepEqual(
    choices.map((v) => v.name),
    ["Café", "Sanroku"],
  );
  const again = insertedVisit(draft, bottom, { after: 2 });
  assert.deepEqual(again.visits, [bottom, cafe, { ...bottom, after: 2 }]);
  const moved = insertedVisit(draft, cafe, { after: 2 });
  assert.deepEqual(moved.visits, [bottom, { ...cafe, after: 2 }]);
});

test("a place on the route twice is offered once", () => {
  const twice = [bottom, { ...bottom, after: 2 }];
  assert.equal(insertChoices(twice).length, 1);
});
