import assert from "node:assert/strict";
import { test } from "node:test";
import {
  anchorPlaces,
  badgeLabel,
  definitiveAnchor,
  nameHolder,
  readAnchorFields,
} from "@/lib/grid-anchors";

/** Calendar photos a to j, one a day. */
const byDay = new Map(
  [..."abcdefghij"].map((name, i) => [`2026-11-${String(i + 1).padStart(2, "0")}`, { path: name }]),
);

/** Each photo's row number in calendar order, with * after the photos that end a row. */
function rows(anchor: string | null) {
  const places = anchorPlaces(byDay, anchor, new Map());
  return [..."abcdefghij"]
    .map((name) => {
      const place = places.get(name);
      return place ? `${place.group}${place.isRowEnd ? "*" : ""}` : "-";
    })
    .join(" ");
}

test("has no rows without an anchor on the calendar", () => {
  assert.equal(rows(null), "- - - - - - - - - -");
  assert.equal(rows("z"), "- - - - - - - - - -");
});

test("counts rows of 3 back and on from the anchor", () => {
  // e is the anchor: c d e are its row, a b the row before, f g h and i j the rows after.
  assert.equal(rows("e"), "0 0* 1 1 1* 2 2 2* 3 3");
});

test("shifts every row when the anchor moves", () => {
  assert.equal(rows("f"), "0 0 0* 1 1 1* 2 2 2* 3");
});

test("uses the latest flagged photo as the one anchor", () => {
  assert.equal(definitiveAnchor(byDay, new Set(["c", "h", "z"])), "h");
  assert.equal(definitiveAnchor(byDay, new Set()), null);
});

test("names a row from the newest of its photos with a name", () => {
  const names = new Map([
    ["c", "Doors"],
    ["d", "Windows"],
  ]);
  const places = anchorPlaces(byDay, "e", names);
  assert.equal(places.get("e")?.name, "Windows");
  assert.equal(places.get("f")?.name, null);
  assert.equal(nameHolder("e", places, names), "d");
  assert.equal(nameHolder("g", places, names), "g");
});

test("reads the anchor flag and group names from photo JSON", () => {
  const { flagged, names } = readAnchorFields([
    { path: "a", data: { socialGridAnchor: true, socialGridGroupName: " " } },
    { path: "b", data: { socialGridAnchor: "yes", socialGridGroupName: "Doors" } },
    { path: "c", data: {} },
  ]);
  assert.deepEqual([...flagged], ["a"]);
  assert.deepEqual([...names], [["b", "Doors"]]);
});

test("labels the badge on a row's last photo", () => {
  const place = { group: 0, isAnchor: true, isRowEnd: true, name: null };
  assert.equal(badgeLabel(place), "Grid Anchor");
  assert.equal(badgeLabel({ ...place, isAnchor: false, name: "Doors " }), "Row end: Doors");
});
