import assert from "node:assert/strict";
import { test } from "node:test";
import { THUMBNAIL, parseVersionKey, versionKeys } from "@/api/versions";

test("a resized version's R2 key names its version and the original's key without its extension", () => {
  assert.deepEqual(parseVersionKey("photos/abc-DSCF1-medium.webp"), {
    originalStem: "photos/abc-DSCF1",
    version: { name: "medium", label: "Medium", maxEdge: 1200 },
  });
  assert.equal(parseVersionKey("photos/abc-DSCF1-thumbnail.webp")?.version, THUMBNAIL);
});

test("a key that isn't a published version's names none", () => {
  assert.equal(parseVersionKey("photos/abc-DSCF1.jpg"), undefined);
  assert.equal(parseVersionKey("photos/abc-DSCF1-huge.webp"), undefined);
  assert.equal(parseVersionKey("medium.webp"), undefined);
});

test("every version's key goes back to its original", () => {
  for (const key of versionKeys("photos/abc-DSCF1.jpg")) {
    assert.equal(parseVersionKey(key)?.originalStem, "photos/abc-DSCF1");
  }
});
