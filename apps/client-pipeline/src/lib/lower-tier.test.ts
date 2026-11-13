import assert from "node:assert/strict";
import { test } from "node:test";
import { isLowerTier, lowerTierPaths } from "@/lib/lower-tier";
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
