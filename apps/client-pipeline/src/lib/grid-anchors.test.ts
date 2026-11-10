import assert from "node:assert/strict";
import { test } from "node:test";
import { alignmentText, anchorGroups, anchorPlaces, feedAlignments } from "@/lib/grid-anchors";

const byDay = new Map(
  ["a", "b", "c", "d", "e", "f"].map((name, i) => [`2026-11-0${i + 1}`, { path: name }]),
);

test("groups an anchor with the 2 calendar photos before it", () => {
  const groups = anchorGroups(byDay, new Set(["d", "b"]));
  assert.deepEqual(
    groups.map((group) => group.members),
    [
      ["b", "a"],
      ["d", "c", "b"],
    ],
  );
  const places = anchorPlaces(groups);
  assert.deepEqual(places.get("d"), { group: 1, isAnchor: true });
  assert.deepEqual(places.get("c"), { group: 1, isAnchor: false });
  assert.equal(places.has("e"), false);
});

test("says whether an anchor's group fills a row of the feed", () => {
  const groups = anchorGroups(byDay, new Set(["d"]));
  const feed = (names: string) => [...names].map((path) => ({ path }));
  assert.deepEqual(
    feedAlignments(feed("fedcba"), groups).map(({ aligned, offset }) => ({ aligned, offset })),
    [{ aligned: false, offset: 2 }],
  );
  assert.deepEqual(
    feedAlignments(feed("xyzdcba"), groups).map(({ aligned, offset }) => ({ aligned, offset })),
    [{ aligned: true, offset: 0 }],
  );
  assert.deepEqual(feedAlignments(feed("cba"), groups), []);
});

test("says what would line a group up", () => {
  const group = { anchor: "d", members: ["d"], index: 0 };
  assert.equal(alignmentText({ group, aligned: true, offset: 0 }), "fills a row.");
  assert.equal(
    alignmentText({ group, aligned: false, offset: 1 }),
    "is 1 tile into its row: 2 more posts after it, or 1 fewer, would line it up.",
  );
});
