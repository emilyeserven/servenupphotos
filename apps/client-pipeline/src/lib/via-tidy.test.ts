import assert from "node:assert/strict";
import { test } from "node:test";
import type { TripPhoto } from "@/lib/trip-days";
import type { GapDraft } from "@/lib/trip-gaps";
import { sharedBy, viaInWalkingOrder, viaOutOfOrder, withViaBy } from "@/lib/via-tidy";

const photos = [
  { id: 1, latitude: 35, longitude: 135 },
  { id: 2, latitude: 35, longitude: 135.01 },
] as TripPhoto[];

const v = (longitude: number) => ({ latitude: 35, longitude });

test("puts each stretch's via points nearest first from the photo before", () => {
  const draft: GapDraft = { gaps: ["walk"], via: { "1": [v(135.006), v(135.002), v(135.004)] } };
  const ordered = viaInWalkingOrder(draft, photos, []);
  assert.deepEqual(
    ordered.via?.["1"]?.map((p) => p.longitude),
    [135.002, 135.004, 135.006],
  );
  assert.equal(viaOutOfOrder(draft, photos, []), true);
  assert.equal(viaOutOfOrder(ordered, photos, []), false);
});

test("keeps the order of a stretch whose start isn't known", () => {
  const draft: GapDraft = { gaps: ["walk"], via: { start: [v(135.006), v(135.002)] } };
  assert.deepEqual(viaInWalkingOrder(draft, photos, []).via?.start, draft.via?.start);
});

test("sets road or walkway on one via point or on all of a stretch's", () => {
  const draft: GapDraft = { gaps: ["walk"], via: { "1": [v(135.002), v(135.004)] } };
  const one = withViaBy(draft, "1", "road", 1);
  assert.deepEqual(
    one.via?.["1"]?.map((p) => p.by),
    [undefined, "road"],
  );
  assert.equal(sharedBy(one.via!["1"]!), undefined);
  const all = withViaBy(one, "1", "foot");
  assert.equal(sharedBy(all.via!["1"]!), "foot");
  const auto = withViaBy(all, "1", undefined);
  assert.equal(sharedBy(auto.via!["1"]!), "");
  assert.equal("by" in auto.via!["1"]![0]!, false);
});
