import assert from "node:assert/strict";
import { test } from "node:test";
import { anchorPlaces } from "@/lib/grid-anchors";

/** Calendar photos a to j, one a day. */
const byDay = new Map(
  [..."abcdefghij"].map((name, i) => [`2026-11-${String(i + 1).padStart(2, "0")}`, { path: name }]),
);

/** Each photo's group number, in calendar order, as one string. */
function groups(anchors: Map<string, string | null>) {
  const places = anchorPlaces(byDay, anchors);
  return [..."abcdefghij"].map((name) => places.get(name)?.group ?? "-").join("");
}

test("has no groups without an anchor", () => {
  assert.equal(groups(new Map()), "----------");
});

test("counts rows of 3 back and on from one anchor", () => {
  // e is the anchor: c d e are its row, a b the row before, f g h and i j the rows after.
  assert.equal(groups(new Map([["e", null]])), "0011122233");
});

test("starts counting again from each anchor, leaving a short row between them", () => {
  // Anchors at c and h: a b c, then d e (cut short), f g h, then i j.
  assert.equal(
    groups(
      new Map([
        ["c", null],
        ["h", null],
      ]),
    ),
    "0001122233",
  );
});

test("names only an anchor's own group, and marks the anchor", () => {
  const places = anchorPlaces(byDay, new Map([["e", "Doors"]]));
  assert.deepEqual(places.get("e"), { group: 1, isAnchor: true, name: "Doors" });
  assert.deepEqual(places.get("c"), { group: 1, isAnchor: false, name: "Doors" });
  assert.deepEqual(places.get("f"), { group: 2, isAnchor: false, name: null });
});
