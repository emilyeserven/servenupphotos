import assert from "node:assert/strict";
import { test } from "node:test";
import type { TripLine, TripVisit } from "@/api/trip-lines";
import type { EditorView } from "@/components/trip-lines/editor-actions";
import { canSave, editedView, endName, modeView, saveLabel, saveNote } from "@/lib/trip-line-view";

const ids = [1, 2, 3];
const dinner: TripVisit = { name: "Dinner", kind: "restaurant", latitude: 1, longitude: 2 };
const byHand: TripLine = {
  id: "d",
  day: "d",
  auto: false,
  segments: [
    { mode: "walk", photos: [1, 2] },
    { mode: "bus", photos: [2, 3] },
  ],
};
const automatic: TripLine = { id: "d", day: "d", auto: true, segments: [], visits: [dinner] };

test("picking Automatic previews it until it's saved, keeping the trip stops", () => {
  const view: EditorView = { kind: "none", stops: { visits: [dinner] } };
  assert.deepEqual(modeView("auto", { view, ids }), {
    kind: "preview",
    stops: { visits: [dinner] },
  });
  assert.deepEqual(modeView("auto", { view: { kind: "none" }, ids, saved: automatic }), {
    kind: "auto",
    stops: { visits: [dinner] },
  });
});

test("picking By hand starts from the line saved by hand, then the automatic one, then walking", () => {
  const none: EditorView = { kind: "none" };
  const fromSaved = modeView("hand", { view: none, ids, saved: byHand });
  assert.deepEqual(fromSaved.kind === "hand" && fromSaved.draft.gaps, ["walk", "bus"]);
  const fromAuto = modeView("hand", { view: none, ids, auto: byHand });
  assert.deepEqual(fromAuto.kind === "hand" && fromAuto.draft.gaps, ["walk", "bus"]);
  const walking = modeView("hand", { view: none, ids });
  assert.deepEqual(walking.kind === "hand" && walking.draft.gaps, ["walk", "walk"]);
});

test("picking By hand again brings back the line by hand shown last", () => {
  const lastHand = { gaps: ["break", "walk"] as const };
  const view = modeView("hand", {
    view: { kind: "auto" },
    ids,
    saved: byHand,
    lastHand: { gaps: [...lastHand.gaps] },
  });
  assert.deepEqual(view.kind === "hand" && view.draft.gaps, ["break", "walk"]);
});

test("picking No line keeps the trip stops of the line by hand shown", () => {
  const view: EditorView = { kind: "hand", draft: { gaps: ["walk", "walk"], visits: [dinner] } };
  assert.deepEqual(modeView("none", { view, ids }), { kind: "none", stops: { visits: [dinner] } });
});

test("changing only the trip stops keeps the automatic line or no line; anything else draws by hand", () => {
  const shown = { gaps: ["walk" as const, "walk" as const] };
  const withStop = { ...shown, visits: [dinner] };
  assert.deepEqual(editedView({ kind: "none" }, shown, withStop), {
    kind: "none",
    stops: { visits: [dinner] },
  });
  assert.equal(editedView({ kind: "auto" }, shown, withStop).kind, "auto");
  const broken = { gaps: ["break" as const, "walk" as const] };
  assert.deepEqual(editedView({ kind: "auto" }, shown, broken), { kind: "hand", draft: broken });
});

test("the save button says what saving does", () => {
  const hand: EditorView = { kind: "hand", draft: { gaps: [] } };
  assert.equal(saveLabel(hand, undefined), "Save route");
  assert.equal(saveLabel({ kind: "preview" }, undefined), "Turn on automatic line");
  assert.equal(saveLabel({ kind: "auto" }, automatic), "Update automatic line");
  assert.equal(saveLabel({ kind: "none" }, byHand), "Remove route");
  assert.equal(saveLabel({ kind: "none" }, undefined), "Save trip stops");
});

test("only changes can be saved, except the automatic line, which can always be drawn again", () => {
  assert.equal(canSave({ kind: "none" }, false), false);
  assert.equal(canSave({ kind: "none" }, true), true);
  assert.equal(canSave({ kind: "auto" }, false), true);
});

test("the save bar warns when saving turns the automatic line off or removes the line", () => {
  const hand: EditorView = { kind: "hand", draft: { gaps: [] } };
  assert.match(saveNote(hand, automatic, true), /turns the automatic line off/);
  assert.equal(saveNote(hand, byHand, true), "");
  assert.match(saveNote({ kind: "none" }, byHand, true), /removes the line/);
  assert.match(saveNote({ kind: "auto", stops: {} }, automatic, true), /Trip stops changed/);
  assert.match(saveNote({ kind: "auto" }, automatic, false), /redraws/);
  assert.equal(saveNote(hand, byHand, false), "");
});

test("the strip's Start and End name the spot, or else the trip stop there", () => {
  const lunch = { ...dinner, name: "Lunch" };
  assert.equal(endName("start", { latitude: 0, longitude: 0, label: "Hotel" }, []), "Hotel");
  assert.equal(endName("start", { latitude: 0, longitude: 0 }, []), "Spot on the map");
  assert.equal(endName("start", undefined, [lunch, dinner]), "Lunch");
  assert.equal(endName("end", undefined, [lunch, dinner]), "Dinner");
  assert.equal(endName("end", undefined, []), undefined);
});
