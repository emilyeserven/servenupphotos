import assert from "node:assert/strict";
import { test } from "node:test";
import type { SocialPhoto } from "@/api/publish";
import { instagramShortBy, instagramUrgency, photoProblems } from "@/lib/needs-attention";

test("is high with 5 or more days to schedule and medium with 4 or fewer", () => {
  assert.equal(instagramUrgency(instagramShortBy(0)), "high");
  assert.equal(instagramUrgency(5), "high");
  assert.equal(instagramUrgency(4), "medium");
  assert.equal(instagramUrgency(1), "medium");
});

test("leaves photos an LLM found no place for out of the photos without a place", () => {
  const data = {
    gpsPosition: "37.5, 127.0",
    places: [],
    tags: ["x"],
    genres: ["y"],
    albums: ["z"],
  };
  const photos = ["a", "b"].map(
    (name) => ({ path: `${name}.json`, data }) as unknown as SocialPhoto,
  );
  const count = (skip?: Set<string>) =>
    photoProblems(photos, new Map(), skip).find((p) => p.problem === "noPlaces")?.count;
  assert.equal(count(), 2);
  assert.equal(count(new Set(["a.json"])), 1);
  assert.equal(count(new Set(["a.json", "b.json"])), undefined);
});
