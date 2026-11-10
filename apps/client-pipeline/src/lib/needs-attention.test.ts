import assert from "node:assert/strict";
import { test } from "node:test";
import { instagramShortBy, instagramUrgency } from "@/lib/needs-attention";

test("is high with 5 or more days to schedule and medium with 4 or fewer", () => {
  assert.equal(instagramUrgency(instagramShortBy(0)), "high");
  assert.equal(instagramUrgency(5), "high");
  assert.equal(instagramUrgency(4), "medium");
  assert.equal(instagramUrgency(1), "medium");
});
