import assert from "node:assert/strict";
import { test } from "node:test";
import type { FilterOption } from "@portfolio/lib/filter-options";
import { searchAndSortGroups } from "@portfolio/lib/group-list";

/** A tag choice with only its name, depth and count. */
function tag(name: string, depth: number, count: number): FilterOption {
  const label = { english: name, romanized: name, phonetic: name, native: name };
  return { key: "tag", value: name, label, depth, count };
}

const TAGS = [
  tag("autumn", 0, 8),
  tag("alley", 0, 9),
  tag("yokocho", 1, 1),
  tag("nonbei", 1, 4),
  tag("beach", 0, 3),
];

/** The names of the rows, a "~" before a parent shown only for context. */
function names(rows: ReturnType<typeof searchAndSortGroups>): string[] {
  return rows.map(({ option, context }) => (context ? "~" : "") + option.value);
}

test("keeps the set order with no search", () => {
  assert.deepEqual(names(searchAndSortGroups(TAGS, "set", "")), [
    "autumn",
    "alley",
    "yokocho",
    "nonbei",
    "beach",
  ]);
});

test("sorts A to Z and Z to A, children under their parent", () => {
  assert.deepEqual(names(searchAndSortGroups(TAGS, "az", "")), [
    "alley",
    "nonbei",
    "yokocho",
    "autumn",
    "beach",
  ]);
  assert.deepEqual(names(searchAndSortGroups(TAGS, "za", "")), [
    "beach",
    "autumn",
    "alley",
    "yokocho",
    "nonbei",
  ]);
});

test("sorts by count, most and fewest first, within each parent", () => {
  assert.deepEqual(names(searchAndSortGroups(TAGS, "most", "")), [
    "alley",
    "nonbei",
    "yokocho",
    "autumn",
    "beach",
  ]);
  assert.deepEqual(names(searchAndSortGroups(TAGS, "fewest", "")), [
    "beach",
    "autumn",
    "alley",
    "yokocho",
    "nonbei",
  ]);
});

test("a matching child keeps its parent above it for context", () => {
  assert.deepEqual(names(searchAndSortGroups(TAGS, "set", " YOKO ")), ["~alley", "yokocho"]);
});

test("a matching parent shows everything under it", () => {
  assert.deepEqual(names(searchAndSortGroups(TAGS, "set", "alley")), [
    "alley",
    "yokocho",
    "nonbei",
  ]);
});

test("leaves nothing when nothing matches", () => {
  assert.deepEqual(searchAndSortGroups(TAGS, "az", "zzz"), []);
});
