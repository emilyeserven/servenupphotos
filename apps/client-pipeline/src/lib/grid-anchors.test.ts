import assert from "node:assert/strict";
import { test } from "node:test";
import { anchorGroups, anchorPlaces } from "@/lib/grid-anchors";

const byDay = new Map(
  ["a", "b", "c", "d", "e", "f"].map((name, i) => [`2026-11-0${i + 1}`, { path: name }]),
);

test("groups an anchor with the 2 calendar photos before it, with its optional name", () => {
  const groups = anchorGroups(
    byDay,
    new Map([
      ["d", "Doors"],
      ["b", null],
    ]),
  );
  assert.deepEqual(
    groups.map(({ members, name }) => ({ members, name })),
    [
      { members: ["b", "a"], name: null },
      { members: ["d", "c", "b"], name: "Doors" },
    ],
  );
  const places = anchorPlaces(groups);
  assert.deepEqual(places.get("d"), { group: 1, isAnchor: true, name: "Doors" });
  assert.deepEqual(places.get("c"), { group: 1, isAnchor: false, name: "Doors" });
  assert.equal(places.has("e"), false);
});
