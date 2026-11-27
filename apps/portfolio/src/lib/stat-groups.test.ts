import assert from "node:assert/strict";
import { test } from "node:test";
import type { Photo } from "@portfolio/lib/photos";
import { type GroupDef, groupChains, tally } from "@portfolio/lib/stat-groups";

test("tally counts the photos with each key and leaves out the ones without", () => {
  const photos = [
    { city: "Tokyo" },
    { city: "Seoul" },
    { city: "Tokyo" },
    { city: null },
  ] as Photo[];
  assert.deepEqual(
    [...tally(photos, (p) => p.city)],
    [
      ["Tokyo", 2],
      ["Seoul", 1],
    ],
  );
});

/** A group with this ID and what it narrows or is linked with. */
function def(id: string, fields: Partial<GroupDef> = {}): GroupDef {
  return {
    id,
    build: () => ({ title: id, rows: [], missing: 0, missingReason: "unknown" }),
    ...fields,
  } as GroupDef;
}

/** The IDs in each run groupChains lays the groups out in. */
function runs(groups: GroupDef[]): string[][] {
  return groupChains(groups).map((chain) => chain.map((g) => g.id));
}

test("a group that narrows another runs with the ones it narrows down the line", () => {
  assert.deepEqual(
    runs([
      def("cities", { narrows: "countries" }),
      def("countries", { narrows: "years" }),
      def("years"),
      def("cameras"),
    ]),
    [["cities", "countries", "years"], ["cameras"]],
  );
});

test("linked groups run together, and a loop of narrowing stops where it comes around", () => {
  assert.deepEqual(
    runs([
      def("iso", { linked: "triangle" }),
      def("tags"),
      def("aperture", { linked: "triangle" }),
    ]),
    [["iso", "aperture"], ["tags"]],
  );
  assert.deepEqual(runs([def("a", { narrows: "b" }), def("b", { narrows: "a" })]), []);
  assert.deepEqual(
    runs([def("top", { narrows: "a" }), def("a", { narrows: "b" }), def("b", { narrows: "a" })]),
    [["top", "a", "b"]],
  );
});
