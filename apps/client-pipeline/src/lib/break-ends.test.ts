import assert from "node:assert/strict";
import { test } from "node:test";
import { breakEndOf, isBreakPick, withBreakEnd } from "@/lib/break-ends";
import { draftOf, type GapDraft, segmentsOf } from "@/lib/trip-gaps";

const hotel = { latitude: 34.66, longitude: 135.5, label: "Hotel" };
const station = { latitude: 34.7, longitude: 135.49, label: "Station" };

test("each group around a break gets its own end and start", () => {
  const draft: GapDraft = {
    gaps: ["walk", "break", "walk"],
    breakEnds: { "2": hotel },
    breakStarts: { "3": station },
  };
  assert.deepEqual(segmentsOf([1, 2, 3, 4], draft), [
    { mode: "walk", photos: [1, 2], end: hotel },
    { mode: "walk", start: station, photos: [3, 4] },
  ]);
});

test("a lone photo after a break is drawn from its start spot", () => {
  const draft: GapDraft = { gaps: ["walk", "break"], breakStarts: { "3": hotel } };
  assert.deepEqual(segmentsOf([1, 2, 3], draft), [
    { mode: "walk", photos: [1, 2] },
    { mode: "walk", start: hotel, photos: [3] },
  ]);
});

test("a break's spots are left out once the gap isn't a break", () => {
  const draft: GapDraft = { gaps: ["walk"], breakEnds: { "1": hotel } };
  assert.deepEqual(segmentsOf([1, 2], draft), [{ mode: "walk", photos: [1, 2] }]);
});

test("a saved line's break spots come back as the break's, not the day's", () => {
  const draft = draftOf(
    [1, 2, 3],
    [
      { mode: "walk", photos: [1], end: hotel },
      { mode: "walk", start: station, photos: [2, 3] },
    ],
  );
  assert.deepEqual(draft.gaps, ["break", "walk"]);
  assert.deepEqual(draft.breakEnds, { "1": hotel });
  assert.deepEqual(draft.breakStarts, { "2": station });
  assert.equal(draft.start, undefined);
  assert.equal(draft.end, undefined);
});

test("sets, reads and removes a break's spot", () => {
  const set = withBreakEnd({ gaps: ["break"] }, "break-end:1", hotel);
  assert.deepEqual(breakEndOf(set, "break-end:1"), hotel);
  assert.equal(breakEndOf(set, "break-start:2"), undefined);
  assert.deepEqual(withBreakEnd(set, "break-end:1", undefined).breakEnds, {});
  assert.equal(isBreakPick("break-start:2"), true);
  assert.equal(isBreakPick("entrance:2"), false);
});
