import assert from "node:assert/strict";
import { test } from "node:test";
import { isLowerTier, lowerTierPaths, withLocalLowerTier, withLowerTier } from "@/lib/lower-tier";
import type { LocalEdit } from "@/stores/local-edits";

test("counts a photo as Lower Tier only when its lowerTier is true", () => {
  assert.equal(isLowerTier({ lowerTier: true }), true);
  assert.equal(isLowerTier({ lowerTier: null }), false);
  assert.equal(isLowerTier({ lowerTier: "true" }), false);
  assert.equal(isLowerTier({}), false);
  assert.equal(isLowerTier(undefined), false);
});

test("finds Lower Tier photos with the local edits made, skipping files that couldn't be read", () => {
  const files = [
    { path: "photos/a.json", data: { lowerTier: true } },
    { path: "photos/b.json", data: {} },
    { path: "photos/c.json", data: { lowerTier: true } },
    { path: "photos/d.json", error: "Couldn't read it." },
  ];
  const edits: Record<string, LocalEdit> = {
    "photos/b.json": {
      kind: "photos",
      path: "photos/b.json",
      before: {},
      fields: { lowerTier: true },
    },
    "photos/c.json": {
      kind: "photos",
      path: "photos/c.json",
      before: { lowerTier: true },
      fields: { lowerTier: null },
    },
  };
  assert.deepEqual([...lowerTierPaths(files, edits)].sort(), ["photos/a.json", "photos/b.json"]);
});

test("saves the mark as true, and taking it off sets null only on a file that had the field", () => {
  assert.deepEqual(withLowerTier({ id: 1 }, true), { id: 1, lowerTier: true });
  assert.deepEqual(withLowerTier({ id: 1, lowerTier: true }, false), { id: 1, lowerTier: null });
  assert.deepEqual(withLowerTier({ id: 1, lowerTier: null }, false), { id: 1, lowerTier: null });
  assert.deepEqual(withLowerTier({ id: 1 }, false), { id: 1 });
});

test("starts the Photo page from a Lower Tier mark waiting for Commit", () => {
  assert.deepEqual(withLocalLowerTier({ id: 1 }, { lowerTier: true }), { id: 1, lowerTier: true });
  assert.deepEqual(withLocalLowerTier({ id: 1, lowerTier: true }, { lowerTier: null }), {
    id: 1,
    lowerTier: null,
  });
  assert.deepEqual(withLocalLowerTier({ id: 1 }, { undecided: true }), { id: 1 });
  assert.deepEqual(withLocalLowerTier({ id: 1 }, undefined), { id: 1 });
});
