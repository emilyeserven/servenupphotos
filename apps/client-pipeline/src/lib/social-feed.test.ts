import assert from "node:assert/strict";
import { test } from "node:test";
import { type FeedPhoto, feedAsOf, feedEntries } from "@/lib/social-feed";
import type { DayPost } from "@/lib/social-post-days";

function photo(name: string): FeedPhoto {
  return { path: `photos/${name}.json`, name, image: null };
}

function post(name: string, status: DayPost["status"]): DayPost {
  return { photo: { ...photo(name), data: {}, inFlight: false }, status, url: "" };
}

const byDay = new Map([
  ["2026-11-01", photo("a")],
  ["2026-11-03", photo("c")],
  ["2026-11-05", photo("e")],
]);
const posts = new Map([
  ["2026-11-02", [post("b", "scheduled")]],
  ["2026-11-03", [post("c", "scheduled")]],
]);

const names = (entries: ReturnType<typeof feedEntries>) =>
  entries.map((entry) => `${entry.name}:${entry.source}`);

test("puts calendar days and posts in one feed, newest first", () => {
  assert.deepEqual(names(feedEntries(byDay, posts)), [
    "e:calendar",
    "c:scheduled",
    "b:scheduled",
    "a:calendar",
  ]);
});

test("shows the feed as of a day, with that day's photos and none after", () => {
  const entries = feedEntries(byDay, posts);
  assert.deepEqual(names(feedAsOf(entries, "2026-11-03")), [
    "c:scheduled",
    "b:scheduled",
    "a:calendar",
  ]);
  assert.deepEqual(feedAsOf(entries, "2026-10-31"), []);
});

test("keeps a photo posted on two days twice", () => {
  const twice = new Map([["2026-11-04", [post("a", "planned")]]]);
  assert.deepEqual(names(feedEntries(byDay, twice)), [
    "e:calendar",
    "a:planned",
    "c:calendar",
    "a:calendar",
  ]);
});
