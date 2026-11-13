import assert from "node:assert/strict";
import { test } from "node:test";
import { readShowLowerTier, shownTiers } from "./lower-tier.ts";

const photos = [
  { id: 1, lowerTier: false },
  { id: 2, lowerTier: true },
  { id: 3, lowerTier: false },
];

test("Lower Tier photos are left out unless the setting is on", () => {
  assert.deepEqual(
    shownTiers(photos, false).map(({ id }) => id),
    [1, 3],
  );
  assert.deepEqual(
    shownTiers(photos, true).map(({ id }) => id),
    [1, 2, 3],
  );
});

test("the setting is off where storage can't be read", () => {
  assert.equal(readShowLowerTier(), false);
});
