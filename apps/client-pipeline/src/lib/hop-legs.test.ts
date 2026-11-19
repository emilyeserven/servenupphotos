import assert from "node:assert/strict";
import { test } from "node:test";
import type { TripSegment, TripTransitLine, TripVisit } from "@/api/trip-lines";
import { legKeys } from "@/lib/hop-legs";
import { draftOf, type GapDraft, segmentsOf, walkingDraft, withGap } from "@/lib/trip-gaps";

const stop: TripVisit = { name: "Kawato", kind: "station", latitude: 1, longitude: 1, after: 1 };
const kita: TripTransitLine = { id: 1, name: "北松江線", source: "mlit" };
const taisha: TripTransitLine = { id: 2, name: "大社線", source: "mlit" };

test("each leg of a hop is known by its first photo and its number after a trip stop", () => {
  const segments: TripSegment[] = [
    { mode: "train", start: { latitude: 0, longitude: 0 }, photos: [1] },
    { mode: "train", photos: [1], end: { latitude: 1, longitude: 1 } },
    {
      mode: "walk",
      start: { latitude: 1, longitude: 1 },
      photos: [],
      end: { latitude: 2, longitude: 2 },
    },
    { mode: "train", start: { latitude: 2, longitude: 2 }, photos: [2] },
    { mode: "bus", photos: [2, 3] },
  ];
  assert.deepEqual(legKeys(segments), ["start+1", "1", "1+1", "1+2", "2"]);
});

test("each leg of a train ride cut at a trip stop keeps its own line through saving", () => {
  const draft: GapDraft = {
    ...withGap(walkingDraft([1, 2]), 0, "train"),
    visits: [stop],
    lines: { "1": { mode: "train", line: kita }, "1+1": { mode: "train", line: taisha } },
  };
  const segments = segmentsOf([1, 2], draft);
  assert.deepEqual(
    segments.map((s) => s.line?.name),
    ["北松江線", "大社線"],
  );
  assert.deepEqual(draftOf([1, 2], segments).lines, draft.lines);
});
