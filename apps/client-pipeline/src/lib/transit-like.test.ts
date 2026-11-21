import assert from "node:assert/strict";
import { test } from "node:test";
import type { TripSegment } from "@/api/trip-lines";
import { wayOf, withLegLike } from "@/lib/transit-like";
import { draftOf, segmentsOf, walkingDraft, withGap } from "@/lib/trip-gaps";

test("a transit hop drawn like a car keeps it through saving, and goes back to transit", () => {
  const draft = withLegLike(withGap(walkingDraft([1, 2]), 0, "transit"), "1", "car");
  const [hop] = segmentsOf([1, 2], draft);
  assert.equal(hop?.like, "car");
  assert.equal(draftOf([1, 2], [hop!]).likes?.["1"], "car");
  assert.equal(segmentsOf([1, 2], withLegLike(draft, "1"))[0]?.like, undefined);
});

test("only a transit hop borrows a mode", () => {
  const draft = withLegLike(withGap(walkingDraft([1, 2]), 0, "train"), "1", "car");
  assert.equal(segmentsOf([1, 2], draft)[0]?.like, undefined);
});

test("a hop is drawn like the mode it borrows, unless it rides a found line", () => {
  const hop: TripSegment = { mode: "transit", like: "car", photos: [1, 2] };
  assert.equal(wayOf(hop), "car");
  assert.equal(wayOf({ ...hop, line: { id: 0, name: "Local bus", source: "named" } }), "car");
  assert.equal(wayOf({ ...hop, line: { id: 7, name: "Bus 7" } }), "transit");
  assert.equal(wayOf({ mode: "train", like: "car", photos: [1, 2] }), "train");
});
