import assert from "node:assert/strict";
import { test } from "node:test";
import type { TripTransitLine } from "@/api/trip-lines";
import { isRopewayPick, ropewayPick, withRopeway, withRopewayEnd } from "@/lib/ropeway-ends";
import { draftOf, type GapDraft, segmentsOf, walkingDraft, withGap } from "@/lib/trip-gaps";

const shinKobe: TripTransitLine = { id: 0, name: "Shin-Kobe Ropeway", source: "named" };
const spots = new Map([
  [1, { latitude: 34.7, longitude: 135.19 }],
  [2, { latitude: 34.71, longitude: 135.18 }],
]);
const bottom = { latitude: 34.701, longitude: 135.191 };
const top = { latitude: 34.709, longitude: 135.181 };

/** A day of two photos joined by a ropeway named by hand. */
function named(): GapDraft {
  const draft = withGap(walkingDraft([1, 2]), 0, "ropeway");
  return { ...draft, lines: { "1": { mode: "ropeway", line: shinKobe } } };
}

test("a ropeway's station picked on the map draws it straight from there, walking from the photo", () => {
  const segments = segmentsOf([1, 2], named());
  const draft = withRopewayEnd(named(), segments, spots, ropewayPick("start", "1"), bottom);
  const [hop] = segmentsOf([1, 2], draft);
  assert.deepEqual(hop!.board, { ...bottom, label: "Start station" });
  assert.equal(hop!.alight, undefined);
  assert.deepEqual(hop!.path, [
    [135.191, 34.701],
    [135.18, 34.71],
  ]);
});

test("both stations make the ride run between them, and the line keeps them through saving", () => {
  let draft = named();
  draft = withRopewayEnd(
    draft,
    segmentsOf([1, 2], draft),
    spots,
    ropewayPick("start", "1"),
    bottom,
  );
  draft = withRopewayEnd(draft, segmentsOf([1, 2], draft), spots, ropewayPick("end", "1"), top);
  const segments = segmentsOf([1, 2], draft);
  assert.deepEqual(segments[0]!.path, [
    [135.191, 34.701],
    [135.181, 34.709],
  ]);
  assert.deepEqual(draftOf([1, 2], segments).lines, draft.lines);
});

test("moving a station keeps its name", () => {
  const hop = segmentsOf([1, 2], named())[0]!;
  let draft = withRopeway(named(), hop, "1", spots, {
    line: shinKobe,
    board: { ...bottom, label: "Sanroku" },
  });
  draft = withRopewayEnd(draft, segmentsOf([1, 2], draft), spots, ropewayPick("start", "1"), top);
  assert.equal(segmentsOf([1, 2], draft)[0]!.board?.label, "Sanroku");
});

test("with neither station it's only named, drawn straight between its photos", () => {
  const hop = segmentsOf([1, 2], named())[0]!;
  const withStation = withRopeway(named(), hop, "1", spots, { line: shinKobe, board: bottom });
  const ridden = segmentsOf([1, 2], withStation)[0]!;
  const back = withRopeway(withStation, ridden, "1", spots, { line: shinKobe });
  const [plain] = segmentsOf([1, 2], back);
  assert.equal(plain!.board, undefined);
  assert.equal(plain!.path, undefined);
  assert.equal(plain!.line?.name, "Shin-Kobe Ropeway");
});

test("a ropeway with no name yet, or another kind of hop, takes no station", () => {
  const draft = withGap(walkingDraft([1, 2]), 0, "ropeway");
  const picked = withRopewayEnd(draft, segmentsOf([1, 2], draft), spots, "ropeway-start:1", top);
  assert.equal(picked, draft);
  assert.equal(isRopewayPick("ropeway-end:1+1"), true);
  assert.equal(isRopewayPick("entrance:1"), false);
});
