import assert from "node:assert/strict";
import { test } from "node:test";
import type { TripVisit } from "@/api/trip-lines";
import { draftOf, type GapDraft, segmentsOf, walkingDraft, withGap } from "@/lib/trip-gaps";

/** A station trip stop at x, after photo after (or before the first photo), reached by mode. */
function station(
  name: string,
  x: number,
  at: number | "first",
  mode?: TripVisit["mode"],
): TripVisit {
  return {
    name,
    kind: "station",
    latitude: x,
    longitude: x,
    ...(at === "first" ? { first: true } : { after: at }),
    ...(mode && { mode }),
  };
}

/** Each segment's mode, photos, and the stops or spots it starts and ends at. */
function shape(draft: GapDraft, photos: number[]) {
  return segmentsOf(photos, draft).map((s) => [s.mode, s.start?.label, s.photos, s.end?.label]);
}

test("a stop walked to in the middle of a train ride cuts the ride there", () => {
  const draft: GapDraft = {
    ...withGap(walkingDraft([1, 2]), 0, "train"),
    visits: [station("Matsue", 1, 1), station("Matsue Shinjiko Onsen", 2, 1, "walk")],
  };
  assert.deepEqual(shape(draft, [1, 2]), [
    ["train", undefined, [1], "Matsue"],
    ["walk", "Matsue", [], "Matsue Shinjiko Onsen"],
    ["train", "Matsue Shinjiko Onsen", [2], undefined],
  ]);
});

test("a station gone back to by car in the middle of a walk cuts the walk", () => {
  const draft: GapDraft = { ...walkingDraft([1, 2, 3]), visits: [station("Izumo", 1, 2, "car")] };
  assert.deepEqual(shape(draft, [1, 2, 3]), [
    ["walk", undefined, [1, 2], undefined],
    ["car", undefined, [2], "Izumo"],
    ["walk", "Izumo", [3], undefined],
  ]);
});

test("a stop reached the way its stretch was travelled leaves the segment whole", () => {
  const draft: GapDraft = {
    ...withGap(walkingDraft([1, 2]), 0, "bus"),
    visits: [station("Stop", 1, 1, "bus")],
  };
  assert.deepEqual(shape(draft, [1, 2]), [["bus", undefined, [1, 2], undefined]]);
});

test("reads a cut line back as the same gaps and start", () => {
  const photos = [1, 2, 3];
  const visits = [
    station("Start", 0.5, "first"),
    station("Matsue", 1, 1),
    station("Onsen", 2, 1, "walk"),
  ];
  const draft: GapDraft = {
    ...withGap(withGap(walkingDraft(photos), 0, "train"), -1, "bus"),
    visits,
  };
  const back = draftOf(photos, segmentsOf(photos, draft));
  assert.deepEqual(back.gaps, ["train", "walk"]);
  assert.equal(back.startGap, "bus");
});

test("a stop after the last photo, driven to, ends the day in a car", () => {
  const draft: GapDraft = { ...walkingDraft([1, 2]), visits: [station("Hotel", 3, 2, "car")] };
  assert.deepEqual(shape(draft, [1, 2]), [
    ["walk", undefined, [1, 2], undefined],
    ["car", undefined, [2], "Hotel"],
  ]);
  assert.deepEqual(draftOf([1, 2], segmentsOf([1, 2], draft)).gaps, ["walk"]);
});
