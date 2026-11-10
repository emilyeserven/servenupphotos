import assert from "node:assert/strict";
import { test } from "node:test";
import type { DayPost } from "@/lib/social-post-days";
import { postsByTab } from "@/lib/social-post-tabs";

function post(name: string, status: DayPost["status"]): DayPost {
  const photo = { path: `photos/${name}.json`, name, image: null, data: {}, inFlight: false };
  return { photo, status, url: "" };
}

const posts = new Map([
  ["2026-11-12", [post("future", "scheduled"), post("later-plan", "planned")]],
  ["2026-11-01", [post("old", "scheduled")]],
  ["2026-11-10", [post("today", "scheduled")]],
  ["2026-11-05", [post("missed-plan", "planned")]],
  ["2026-11-20", [post("far", "scheduled")]],
]);

const names = (list: { post: DayPost }[]) => list.map(({ post: p }) => p.photo.name);

test("sorts posts into Posted, Scheduled and Unposted on today", () => {
  const tabs = postsByTab(posts, "2026-11-10");
  assert.deepEqual(names(tabs.posted), ["today", "old"]);
  assert.deepEqual(names(tabs.scheduled), ["future", "far"]);
  assert.deepEqual(names(tabs.unposted), ["missed-plan", "later-plan"]);
});
