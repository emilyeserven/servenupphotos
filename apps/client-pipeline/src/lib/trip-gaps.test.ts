import assert from "node:assert/strict";
import { test } from "node:test";
import type { TripVisit } from "@/api/trip-lines";
import {
  changedItem,
  draftOf,
  type GapDraft,
  segmentKey,
  segmentsOf,
  walkingDraft,
  withGap,
  withItem,
  withStops,
} from "@/lib/trip-gaps";

const draft: GapDraft = { gaps: ["walk", "walk"] };

test("starts with every gap walking", () => {
  assert.deepEqual(walkingDraft([1, 2, 3]), { gaps: ["walk", "walk"] });
  assert.deepEqual(walkingDraft([1]), { gaps: [] });
});

test("changes one gap and leaves the draft it came from alone", () => {
  const changed = withGap(draft, 1, "train");
  assert.deepEqual(changed.gaps, ["walk", "train"]);
  assert.deepEqual(draft.gaps, ["walk", "walk"]);
});

test("adds an item to the end of a list, starting the list when there is none", () => {
  const visit = { name: "Cafe", kind: "cafe", latitude: 1, longitude: 2, after: 5 } as TripVisit;
  const once = withItem(draft, "visits", visit);
  assert.deepEqual(once.visits, [visit]);
  const twice = withItem(once, "visits", { ...visit, after: 6 });
  assert.deepEqual(
    twice.visits?.map((v) => v.after),
    [5, 6],
  );
  assert.equal(draft.visits, undefined);
});

test("changes one item of a list, or removes it for null", () => {
  const base = withItem(withItem(draft, "groups", "10"), "groups", "20");
  assert.deepEqual(changedItem(base, "groups", 0, "11").groups, ["11", "20"]);
  assert.deepEqual(changedItem(base, "groups", 1, null).groups, ["10"]);
  assert.deepEqual(changedItem(base, "groups", 7, "x").groups, ["10", "20"]);
});

test("walks one line through photos whose gaps are all walking", () => {
  const segments = segmentsOf([1, 2, 3], walkingDraft([1, 2, 3]));
  assert.equal(segments.length, 1);
  assert.deepEqual(segments[0]?.mode, "walk");
  assert.deepEqual(segments[0]?.photos, [1, 2, 3]);
});

test("makes a hop of its own for a train gap, with walks either side", () => {
  const segments = segmentsOf([1, 2, 3, 4], { gaps: ["walk", "train", "walk"] });
  assert.deepEqual(
    segments.map((s) => [s.mode, s.photos]),
    [
      ["walk", [1, 2]],
      ["train", [2, 3]],
      ["walk", [3, 4]],
    ],
  );
});

test("stops the line at a break and starts it again at the next photo", () => {
  const segments = segmentsOf([1, 2, 3, 4], { gaps: ["walk", "break", "walk"] });
  assert.deepEqual(
    segments.map((s) => s.photos),
    [
      [1, 2],
      [3, 4],
    ],
  );
});

test("draws no line for a lone photo", () => {
  assert.deepEqual(segmentsOf([1], { gaps: [] }), []);
});

test("starts the line at the start spot, and ends it at the end spot", () => {
  const start = { latitude: 1, longitude: 2 };
  const end = { latitude: 3, longitude: 4 };
  const [segment] = segmentsOf([1, 2], { gaps: ["walk"], start, end });
  assert.deepEqual(segment?.start, start);
  assert.deepEqual(segment?.end, end);
});

test("reads a saved trip line back as the same gaps", () => {
  const gaps: GapDraft["gaps"] = ["walk", "train", "break", "walk"];
  const photos = [1, 2, 3, 4, 5];
  const segments = segmentsOf(photos, { gaps });
  assert.deepEqual(draftOf(photos, segments).gaps, gaps);
});

test("keys a segment by what makes its path, not by anything else", () => {
  const [segment] = segmentsOf([1, 2], walkingDraft([1, 2]));
  const [other] = segmentsOf([1, 3], walkingDraft([1, 3]));
  assert.equal(segmentKey(segment!), segmentKey({ ...segment! }));
  assert.notEqual(segmentKey(segment!), segmentKey(other!));
});

test("gives a segment the path saved under its key", () => {
  const [plain] = segmentsOf([1, 2], walkingDraft([1, 2]));
  const path: [number, number][] = [
    [0, 0],
    [1, 1],
  ];
  const [routed] = segmentsOf([1, 2], { gaps: ["walk"], paths: { [segmentKey(plain!)]: path } });
  assert.deepEqual(routed?.path, path);
});

test("a trip stop before the first photo starts the line with no start spot, or follows the start spot", () => {
  const stop: TripVisit = {
    name: "Lunch",
    kind: "restaurant",
    latitude: 5,
    longitude: 6,
    first: true,
  };
  const draft: GapDraft = { ...walkingDraft([1, 2]), visits: [stop] };
  const [own] = segmentsOf([1, 2], draft);
  assert.deepEqual(own!.start, { latitude: 5, longitude: 6, label: "Lunch" });
  assert.equal(own!.via, undefined);
  const loaded = withStops({ ...draftOf([1, 2], segmentsOf([1, 2], draft)), visits: [stop] });
  assert.equal(loaded.start, undefined);
  const hotel = { latitude: 1, longitude: 2 };
  const [afterHotel] = segmentsOf([1, 2], { ...draft, start: hotel });
  assert.deepEqual(afterHotel!.start, hotel);
  assert.deepEqual(afterHotel!.via, [{ latitude: 5, longitude: 6, visit: 0 }]);
});

test("a trip stop after the last photo ends the line with no end spot, or comes before the end spot", () => {
  const stop: TripVisit = {
    name: "Dinner",
    kind: "restaurant",
    latitude: 5,
    longitude: 6,
    after: 2,
  };
  const draft: GapDraft = { ...walkingDraft([1, 2]), visits: [stop] };
  const [own] = segmentsOf([1, 2], draft);
  assert.deepEqual(own!.end, { latitude: 5, longitude: 6, label: "Dinner" });
  assert.equal(own!.via, undefined);
  const saved = draftOf([1, 2], segmentsOf([1, 2], draft));
  assert.equal(withStops({ ...saved, visits: [stop] }, 2).end, undefined);
  const hotel = { latitude: 1, longitude: 2 };
  const [toHotel] = segmentsOf([1, 2], { ...draft, end: hotel });
  assert.deepEqual(toHotel!.end, hotel);
  assert.deepEqual(toHotel!.via, [{ after: 2, latitude: 5, longitude: 6, visit: 0 }]);
});

test("a trip stop after the last photo ends the line after a break too", () => {
  const stop: TripVisit = {
    name: "Dinner",
    kind: "restaurant",
    latitude: 5,
    longitude: 6,
    after: 2,
  };
  const segments = segmentsOf([1, 2], { gaps: ["break"], visits: [stop] });
  assert.deepEqual(
    segments.map((s) => [s.photos, s.end?.label]),
    [[[2], "Dinner"]],
  );
});

test("the way from the trip stop before the first photo can be a bus, kept through a save", () => {
  const stop: TripVisit = {
    name: "Lunch",
    kind: "restaurant",
    latitude: 5,
    longitude: 6,
    first: true,
  };
  const draft = withGap({ ...walkingDraft([1, 2]), visits: [stop] }, -1, "bus");
  assert.equal(draft.startGap, "bus");
  const segments = segmentsOf([1, 2], draft);
  assert.deepEqual(
    segments.map((s) => [s.mode, s.photos, s.start?.label]),
    [
      ["bus", [1], "Lunch"],
      ["walk", [1, 2], undefined],
    ],
  );
  assert.equal(draftOf([1, 2], segments).startGap, "bus");
  assert.equal(withGap(draft, -1, "walk").startGap, undefined);
});
